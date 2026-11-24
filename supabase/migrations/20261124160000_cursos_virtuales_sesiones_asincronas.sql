-- =====================================================================
-- PEDSAR · Cursos solo virtuales y HU-16 (tipo de sesión)
-- La empresa dicta todos sus cursos en modalidad virtual, por lo que un curso
-- ya no puede ser presencial ni semipresencial. Cada sesión es virtual en vivo
-- o asíncrona: una clase grabada o material disponible desde su fecha y hora,
-- sin recordatorio de inicio ni registro de asistencia, que no cuenta para el
-- porcentaje de asistencia.
-- =====================================================================

-- 1. Cursos: solo modalidad virtual.
update public.cursos set modalidad = 'VIRTUAL' where modalidad <> 'VIRTUAL';
alter table public.cursos
  add constraint cursos_solo_virtual check (modalidad = 'VIRTUAL');

-- 2. Sesiones: virtual en vivo o asíncrona, con su propio tipo.
create type public.tipo_sesion as enum ('VIRTUAL', 'ASINCRONA');

-- Las funciones de horarios devuelven la columna con su tipo: se recrean.
drop function public.horarios_publicos(uuid[]);
drop function privado.horarios_publicos(uuid[]);

alter table public.sesiones alter column modalidad drop default;
alter table public.sesiones
  alter column modalidad type public.tipo_sesion
  using ('VIRTUAL'::public.tipo_sesion);
alter table public.sesiones alter column modalidad set default 'VIRTUAL';

comment on column public.sesiones.modalidad is
  'HU-16 · VIRTUAL (en vivo) o ASINCRONA. En una sesión asíncrona, enlace_virtual apunta a la grabación o al material.';

create function privado.horarios_publicos(p_cursos uuid[])
returns table(id bigint, curso_id uuid, fecha date, hora_inicio time, duracion_minutos int, modalidad public.tipo_sesion)
language sql stable security definer set search_path = '' as $$
  select s.id, s.curso_id, s.fecha, s.hora_inicio, s.duracion_minutos, s.modalidad
  from public.sesiones s join public.cursos c on c.id = s.curso_id
  where c.estado = 'PUBLICADO' and c.id = any(p_cursos)
$$;
create function public.horarios_publicos(p_cursos uuid[])
returns table(id bigint, curso_id uuid, fecha date, hora_inicio time, duracion_minutos int, modalidad public.tipo_sesion)
language sql stable security invoker set search_path = '' as $$
  select * from privado.horarios_publicos(p_cursos)
$$;
revoke all on function privado.horarios_publicos(uuid[]), public.horarios_publicos(uuid[]) from public;
grant execute on function privado.horarios_publicos(uuid[]), public.horarios_publicos(uuid[]) to anon, authenticated, service_role;

-- La asistencia solo se registra en las sesiones en vivo.
create function privado.validar_asistencia_sesion()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.sesiones where id = new.sesion_id and modalidad = 'ASINCRONA') then
    raise exception 'Las sesiones asíncronas no registran asistencia' using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function privado.validar_asistencia_sesion() from public;
create trigger asistencias_solo_sincronas
  before insert or update of sesion_id on public.asistencias
  for each row execute function privado.validar_asistencia_sesion();

-- El porcentaje de asistencia (requisito del certificado) solo cuenta las sesiones en vivo.
create or replace function public.resultado_academico(p_inscripciones uuid[])
returns table (
  inscripcion_id uuid,
  evaluaciones   int,      -- evaluaciones del curso
  rendidas       int,      -- con al menos un intento calificado
  nota_final     numeric,  -- promedio vigesimal de la mejor nota de cada evaluación; las no rendidas cuentan 0
  sesiones       int,      -- sesiones en vivo ya dictadas (o con asistencia registrada)
  presentes      int,      -- presente o tardanza
  asistencia     numeric,  -- % de sesiones con asistencia
  contenidos     int,
  completados    int,
  progreso       numeric   -- % de contenidos marcados como completados
)
language sql stable security invoker set search_path = '' as $$
  select i.id,
         ev.total,
         ev.rendidas,
         ev.nota_final,
         greatest(se.dictadas, asi.registradas),
         asi.presentes,
         case when greatest(se.dictadas, asi.registradas) > 0
              then round(asi.presentes * 100.0 / greatest(se.dictadas, asi.registradas), 1) end,
         co.total,
         least(cc.hechos, co.total),
         case when co.total > 0 then round(least(cc.hechos, co.total) * 100.0 / co.total, 1) end
  from public.inscripciones i
  cross join lateral (
    select count(*)::int as total,
           count(n.nota)::int as rendidas,
           case when count(*) > 0 then round(avg(coalesce(n.nota, 0)), 2) end as nota_final
    from (
      select max(t.puntaje_obtenido) / nullif(e.puntaje_total, 0) * 20 as nota
      from public.evaluaciones e
      left join public.intentos_evaluacion t on t.evaluacion_id = e.id and t.inscripcion_id = i.id
      where e.curso_id = i.curso_id
      group by e.id, e.puntaje_total
    ) n
  ) ev
  cross join lateral (
    select count(*)::int as dictadas
    from public.sesiones s
    where s.curso_id = i.curso_id and s.fecha <= (now() at time zone 'America/Lima')::date
      and s.modalidad <> 'ASINCRONA'
  ) se
  cross join lateral (
    select count(*)::int as registradas,
           (count(*) filter (where a.estado <> 'AUSENTE'))::int as presentes
    from public.asistencias a
    where a.inscripcion_id = i.id
  ) asi
  cross join lateral (
    select count(c.id)::int as total
    from public.modulos m
    join public.contenidos c on c.modulo_id = m.id
    where m.curso_id = i.curso_id
  ) co
  cross join lateral (
    select count(*)::int as hechos
    from public.contenidos_completados x
    where x.inscripcion_id = i.id
  ) cc
  where i.id = any (p_inscripciones)
$$;

-- Sin recordatorio «inicia en 1 hora» para las sesiones asíncronas.
create or replace function privado.generar_recordatorios_programados()
returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_sesiones     int := 0;
  v_evaluaciones int := 0;
begin
  -- 1. Recordatorios 1 hora antes de una sesión programada (en hora de Perú)
  with candidatas_sesion as (
    select i.estudiante_id as usuario_id,
           s.id            as sesion_id,
           c.titulo        as curso_titulo,
           to_char(s.hora_inicio, 'HH24:MI') as hora_txt
    from public.sesiones s
    join public.cursos c        on c.id = s.curso_id and c.estado = 'PUBLICADO'
    join public.inscripciones i on i.curso_id = c.id and i.estado = 'CONFIRMADA'
    join public.perfiles p      on p.id = i.estudiante_id and p.estado and p.canal_notificacion in ('AMBOS', 'IN_APP')
    where ((s.fecha::text || ' ' || s.hora_inicio::text)::timestamp at time zone 'America/Lima')
          between now() and now() + interval '75 minutes'
      and s.modalidad <> 'ASINCRONA'
      and not exists (
        select 1 from public.recordatorios_enviados r
        where r.usuario_id = i.estudiante_id
          and r.tipo_evento = 'SESION_1H'
          and r.referencia_id = s.id
      )
  ),
  registradas_sesion as (
    insert into public.recordatorios_enviados (usuario_id, tipo_evento, referencia_id)
    select usuario_id, 'SESION_1H', sesion_id from candidatas_sesion
    on conflict do nothing
    returning usuario_id, referencia_id
  ),
  notificadas_sesion as (
    insert into public.notificaciones (usuario_id, mensaje, enlace, tipo)
    select cs.usuario_id,
           'Recordatorio: tu sesión de «' || cs.curso_titulo || '» inicia a las ' || cs.hora_txt,
           '/estudiante',
           'IN_APP'
    from registradas_sesion rs
    join candidatas_sesion cs
      on cs.usuario_id = rs.usuario_id and cs.sesion_id = rs.referencia_id
    returning id
  )
  select count(*)::int into v_sesiones from notificadas_sesion;

  -- 2. Recordatorios 24 horas antes del cierre de una evaluación aún no rendida
  with candidatas_eval as (
    select i.estudiante_id as usuario_id,
           e.id            as evaluacion_id,
           e.titulo        as eval_titulo,
           c.titulo        as curso_titulo
    from public.evaluaciones e
    join public.cursos c        on c.id = e.curso_id and c.estado = 'PUBLICADO'
    join public.inscripciones i on i.curso_id = c.id and i.estado = 'CONFIRMADA'
    join public.perfiles p      on p.id = i.estudiante_id and p.estado and p.canal_notificacion in ('AMBOS', 'IN_APP')
    where e.fecha_limite is not null
      and e.fecha_limite between now() and now() + interval '24 hours'
      and not exists (
        select 1 from public.intentos_evaluacion ie
        where ie.inscripcion_id = i.id and ie.evaluacion_id = e.id
      )
      and not exists (
        select 1 from public.recordatorios_enviados r
        where r.usuario_id = i.estudiante_id
          and r.tipo_evento = 'EVALUACION_24H'
          and r.referencia_id = e.id
      )
  ),
  registradas_eval as (
    insert into public.recordatorios_enviados (usuario_id, tipo_evento, referencia_id)
    select usuario_id, 'EVALUACION_24H', evaluacion_id from candidatas_eval
    on conflict do nothing
    returning usuario_id, referencia_id
  ),
  notificadas_eval as (
    insert into public.notificaciones (usuario_id, mensaje, enlace, tipo)
    select ce.usuario_id,
           'Recordatorio: la evaluación «' || ce.eval_titulo || '» (' || ce.curso_titulo || ') vence en menos de 24 h',
           '/estudiante/evaluaciones/' || ce.evaluacion_id,
           'IN_APP'
    from registradas_eval re
    join candidatas_eval ce
      on ce.usuario_id = re.usuario_id and ce.evaluacion_id = re.referencia_id
    returning id
  )
  select count(*)::int into v_evaluaciones from notificadas_eval;

  return v_sesiones + v_evaluaciones;
end $$;
