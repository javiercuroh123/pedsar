-- =====================================================================
-- PEDSAR · Resultado académico y certificados verificables
-- HU-11 (certificado con instructor y código verificable), Figura 15 (la
-- verificación pública muestra la nota final) y requisitos de aprobación:
-- nota ≥ 13/20 y asistencia ≥ 75 % (src/config/academico.ts).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Resultado académico por inscripción. SECURITY INVOKER: respeta RLS,
--    así cada rol solo obtiene lo que ya puede ver (el estudiante lo suyo,
--    el instructor sus cursos y el administrador todo).
-- ---------------------------------------------------------------------
create function public.resultado_academico(p_inscripciones uuid[])
returns table (
  inscripcion_id uuid,
  evaluaciones   int,      -- evaluaciones del curso
  rendidas       int,      -- con al menos un intento calificado
  nota_final     numeric,  -- promedio vigesimal de la mejor nota de cada evaluación; las no rendidas cuentan 0
  sesiones       int,      -- sesiones ya dictadas (o con asistencia registrada)
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

-- ---------------------------------------------------------------------
-- 2. Datos del certificado congelados al emitirlo: el documento no cambia
--    si después se edita el perfil, el curso o una nota.
-- ---------------------------------------------------------------------
alter table public.certificados
  add column estudiante_nombre text,
  add column curso_titulo      text,
  add column duracion_horas    int,
  add column instructor_nombre text,
  add column nota_final        numeric(4, 2),
  add column asistencia        numeric(5, 1),
  add column motivo_excepcion  text;

comment on column public.certificados.nota_final is 'Nota final (0-20) al emitir; null si el curso no tenía evaluaciones.';
comment on column public.certificados.asistencia is 'Porcentaje de asistencia al emitir; null si no hubo sesiones.';
comment on column public.certificados.motivo_excepcion is
  'Motivo con el que el administrador lo emitió sin cumplir los requisitos; null si los cumplía. No se publica.';

-- ---------------------------------------------------------------------
-- 3. Verificación pública: agrega la nota final y el instructor. Cambia el
--    tipo de retorno, por eso se recrea (y se vuelve a otorgar EXECUTE).
-- ---------------------------------------------------------------------
drop function public.verificar_certificado(text);

create function public.verificar_certificado(p_codigo text)
returns table (
  codigo_unico   text,
  estudiante     text,
  curso          text,
  duracion_horas int,
  fecha_emision  date,
  nota_final     numeric,
  instructor     text
)
language sql stable security definer set search_path = '' as $$
  select c.codigo_unico,
         coalesce(c.estudiante_nombre, p.nombres || ' ' || p.apellidos),
         coalesce(c.curso_titulo, cu.titulo),
         coalesce(c.duracion_horas, cu.duracion_horas),
         c.fecha_emision,
         c.nota_final,
         coalesce(c.instructor_nombre, nullif(trim(ins.nombres || ' ' || ins.apellidos), ''))
  from public.certificados c
  join public.inscripciones i on i.id = c.inscripcion_id
  join public.perfiles p      on p.id = i.estudiante_id
  join public.cursos cu       on cu.id = i.curso_id
  left join public.perfiles ins on ins.id = cu.instructor_id
  where c.codigo_unico = upper(trim(p_codigo))
$$;

grant execute on function public.verificar_certificado(text) to anon, authenticated;
comment on function public.verificar_certificado(text) is
  'Pública a propósito: verificación de certificados por código (HU-11). No expone el motivo de excepción.';
