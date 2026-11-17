-- =====================================================================
-- PEDSAR · Prerrequisitos, emisión automática de certificados y recordatorios
-- HU-04 · HU-06 · HU-07 · HU-08 · HU-11 · HU-21 · HU-41 · RF-04 · RF-08 · RF-11
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. HU-04 · HU-06 · HU-07 · RF-04 — Prerrequisitos de cursos
--    Permite definir requisitos previos descriptivos y/o un curso
--    prerrequisito obligatorio que el estudiante debe haber aprobado o
--    completado al 100 % antes de inscribirse.
-- ---------------------------------------------------------------------
alter table public.cursos
  add column if not exists requisitos_previos text,
  add column if not exists prerrequisito_curso_id uuid references public.cursos (id) on delete set null;

alter table public.cursos drop constraint if exists cursos_prerrequisito_no_ciclo;
alter table public.cursos
  add constraint cursos_prerrequisito_no_ciclo
  check (prerrequisito_curso_id is null or prerrequisito_curso_id <> id);

create index if not exists cursos_prerrequisito_idx
  on public.cursos (prerrequisito_curso_id)
  where prerrequisito_curso_id is not null;

create or replace function public.cumple_prerrequisito(p_estudiante uuid, p_curso uuid)
returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  v_prerrequisito uuid;
begin
  select prerrequisito_curso_id into v_prerrequisito
  from public.cursos
  where id = p_curso;

  if v_prerrequisito is null then
    return true;
  end if;

  return exists (
    select 1
    from public.inscripciones i
    where i.estudiante_id = p_estudiante
      and i.curso_id = v_prerrequisito
      and i.estado = 'CONFIRMADA'
      and (
        exists (select 1 from public.certificados cert where cert.inscripcion_id = i.id)
        or exists (select 1 from public.progreso pr where pr.inscripcion_id = i.id and pr.porcentaje >= 100)
      )
  );
end $$;

grant execute on function public.cumple_prerrequisito(uuid, uuid) to authenticated, service_role;

-- Actualiza registrar_matricula para verificar prerrequisito en la misma transacción
create or replace function public.registrar_matricula(
  p_estudiante  uuid,
  p_curso       uuid,
  p_metodo      public.metodo_pago,
  p_cupon       text default '',
  p_monto       numeric default null,
  p_facturacion jsonb default '{}'::jsonb
)
returns table (
  inscripcion_id uuid,
  codigo         text,
  vence_en       timestamptz,
  pago_id        uuid,
  monto          numeric(10, 2),
  cupon_id       bigint
)
language plpgsql security definer set search_path = '' as $$
declare
  v_curso    record;
  v_cupon    record;
  v_usados   int;
  v_monto    numeric(10, 2);
  v_vence    timestamptz := now() + interval '48 hours';
  v_ins      record;
  v_pago_id  uuid;
begin
  if not exists (
    select 1 from public.perfiles
    where id = p_estudiante and rol = 'estudiante' and estado
  ) then
    raise exception 'Estudiante no válido' using errcode = '42501';
  end if;

  select c.id, c.precio into v_curso
  from public.cursos c
  where c.id = p_curso and c.estado = 'PUBLICADO'
  for share;

  if v_curso.id is null then
    raise exception 'Curso no disponible' using errcode = 'P0002';
  end if;

  if not public.cumple_prerrequisito(p_estudiante, p_curso) then
    raise exception 'Debes completar primero el curso prerrequisito antes de inscribirte'
      using errcode = '22023';
  end if;

  v_monto := v_curso.precio;

  if coalesce(trim(p_cupon), '') <> '' then
    select * into v_cupon
    from public.cupones
    where upper(codigo) = upper(trim(p_cupon))
    for update;

    if v_cupon.id is null or not v_cupon.activo or v_cupon.fecha_vigencia < (now() at time zone 'America/Lima')::date then
      raise exception 'Cupón no válido o vencido' using errcode = '22023';
    end if;

    if v_cupon.usos_maximos is not null then
      select count(*)::int into v_usados
      from public.pagos p
      join public.inscripciones i on i.id = p.inscripcion_id
      where p.cupon_id = v_cupon.id
        and (
          p.estado = 'APROBADO'
          or (i.estado = 'PENDIENTE' and (i.vence_en is null or i.vence_en > now()))
        );

      if v_usados >= v_cupon.usos_maximos then
        raise exception 'Este cupón ya alcanzó su límite de usos' using errcode = '22023';
      end if;
    end if;

    v_monto := round(v_curso.precio * (1 - v_cupon.porcentaje_descuento / 100.0), 2);
  end if;

  if p_monto is not null and round(p_monto, 2) <> v_monto then
    raise exception 'El importe de la inscripción cambió; verifica el monto antes de continuar'
      using errcode = '22023';
  end if;

  insert into public.inscripciones (estudiante_id, curso_id, estado, vence_en)
  values (p_estudiante, p_curso, 'PENDIENTE', v_vence)
  returning id, public.inscripciones.codigo, public.inscripciones.vence_en into v_ins;

  insert into public.pagos (inscripcion_id, cupon_id, monto, metodo, estado, datos_facturacion)
  values (v_ins.id, v_cupon.id, v_monto, p_metodo, 'PENDIENTE', coalesce(p_facturacion, '{}'::jsonb))
  returning id into v_pago_id;

  return query select v_ins.id, v_ins.codigo, v_ins.vence_en, v_pago_id, v_monto, v_cupon.id;
end $$;

-- ---------------------------------------------------------------------
-- 2. HU-11 · RF-08 — Permitir que resultado_academico también funcione
--    con service_role para la emisión automática de certificados
-- ---------------------------------------------------------------------
create or replace function public.resultado_academico(p_inscripciones uuid[])
returns table (
  inscripcion_id uuid,
  evaluaciones   int,
  rendidas       int,
  nota_final     numeric(5, 2),
  sesiones       int,
  presentes      int,
  asistencia     numeric(5, 1),
  contenidos     int,
  completados    int,
  progreso       numeric(5, 1)
)
language sql stable security definer set search_path = '' as $$
  with autorizadas as (
    select i.id, i.curso_id
    from public.inscripciones i
    where i.id = any (p_inscripciones)
      and (
        i.estudiante_id = auth.uid()
        or privado.es_instructor_de(i.curso_id)
        or public.es_admin()
        or coalesce(auth.role(), '') = 'service_role'
        or current_user in ('postgres', 'service_role')
      )
  ),
  mejor_intento as (
    select a.id as inscripcion_id,
           e.id as evaluacion_id,
           max(ie.puntaje_obtenido * 20.0 / nullif(e.puntaje_total, 0)) as nota_20
    from autorizadas a
    join public.evaluaciones e on e.curso_id = a.curso_id
    left join public.intentos_evaluacion ie
           on ie.inscripcion_id = a.id and ie.evaluacion_id = e.id
    group by a.id, e.id
  ),
  notas as (
    select m.inscripcion_id,
           count(m.evaluacion_id)::int as evaluaciones,
           count(m.nota_20)::int       as rendidas,
           round(avg(coalesce(m.nota_20, 0)), 2) as nota_final
    from mejor_intento m
    group by m.inscripcion_id
  ),
  asist as (
    select a.id as inscripcion_id,
           count(s.id)::int as sesiones,
           count(asist.id) filter (where asist.estado in ('PRESENTE', 'TARDANZA'))::int as presentes
    from autorizadas a
    left join public.sesiones s     on s.curso_id = a.curso_id
    left join public.asistencias asist on asist.inscripcion_id = a.id and asist.sesion_id = s.id
    group by a.id
  ),
  avance as (
    select a.id as inscripcion_id,
           count(c.id)::int  as contenidos,
           count(cc.contenido_id)::int as completados
    from autorizadas a
    left join public.modulos m    on m.curso_id = a.curso_id
    left join public.contenidos c on c.modulo_id = m.id
    left join public.contenidos_completados cc
           on cc.inscripcion_id = a.id and cc.contenido_id = c.id
    group by a.id
  )
  select a.id,
         coalesce(n.evaluaciones, 0),
         coalesce(n.rendidas, 0),
         n.nota_final,
         coalesce(s.sesiones, 0),
         coalesce(s.presentes, 0),
         round(s.presentes * 100.0 / nullif(s.sesiones, 0), 1),
         coalesce(v.contenidos, 0),
         coalesce(v.completados, 0),
         round(v.completados * 100.0 / nullif(v.contenidos, 0), 1)
  from autorizadas a
  left join notas  n on n.inscripcion_id = a.id
  left join asist  s on s.inscripcion_id = a.id
  left join avance v on v.inscripcion_id = a.id
$$;

grant execute on function public.resultado_academico(uuid[]) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 3. HU-15 · HU-18 · HU-21 · HU-41 · RF-11 — Perfil (fecha de nacimiento),
--    categorías jerárquicas con estado activo/imagen, preferencia de canal
--    de notificación y recordatorios automáticos (1h sesión, 24h evaluación)
-- ---------------------------------------------------------------------
alter table public.perfiles
  add column if not exists fecha_nacimiento date,
  add column if not exists canal_notificacion text not null default 'AMBOS'
  check (canal_notificacion in ('AMBOS', 'CORREO', 'IN_APP'));

alter table public.categorias
  add column if not exists imagen_url text,
  add column if not exists padre_id bigint references public.categorias (id) on delete set null,
  add column if not exists activa boolean not null default true;

alter table public.categorias drop constraint if exists categorias_padre_no_ciclo;
alter table public.categorias
  add constraint categorias_padre_no_ciclo
  check (padre_id is null or padre_id <> id);

alter table public.evaluaciones
  add column if not exists fecha_limite timestamptz;

create table if not exists public.recordatorios_enviados (
  id            bigint generated always as identity primary key,
  usuario_id    uuid not null references public.perfiles (id) on delete cascade,
  tipo_evento   text not null check (tipo_evento in ('SESION_1H', 'EVALUACION_24H')),
  referencia_id bigint not null,
  enviado_en    timestamptz not null default now(),
  unique (usuario_id, tipo_evento, referencia_id)
);

alter table public.recordatorios_enviados enable row level security;

drop policy if exists "recordatorios_admin" on public.recordatorios_enviados;
create policy "recordatorios_admin" on public.recordatorios_enviados
  for all using (public.es_admin()) with check (public.es_admin());

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

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('recordatorios-programados')
    where exists (select 1 from cron.job where jobname = 'recordatorios-programados');

    perform cron.schedule(
      'recordatorios-programados',
      '*/15 * * * *',
      'select privado.generar_recordatorios_programados()'
    );
  end if;
end $$;
