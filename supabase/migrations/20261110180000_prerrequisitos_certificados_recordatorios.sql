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

-- Actualiza registrar_matricula para verificar el prerrequisito en la misma
-- transacción. Conserva íntegro el cuerpo de 20261110155700 (security invoker,
-- validación del medio de pago, cupón como fila tipada y códigos de error que
-- espera la aplicación); solo se añade la comprobación del prerrequisito.
create or replace function public.registrar_matricula(p_estudiante uuid, p_curso uuid, p_metodo public.metodo_pago,
  p_cupon text, p_monto numeric, p_facturacion jsonb)
returns table(inscripcion_id uuid, codigo text, vence_en timestamptz, pago_id uuid, monto numeric, cupon_id bigint)
language plpgsql security invoker set search_path = '' as $$
declare c public.cursos; cp public.cupones; i public.inscripciones; p public.pagos; importe numeric; usados int;
begin
  if not exists(select 1 from public.perfiles where id = p_estudiante and estado and rol = 'estudiante') then
    raise exception 'Estudiante no habilitado' using errcode = '42501';
  end if;
  if p_metodo not in ('CULQI', 'YAPE', 'PLIN') then raise exception 'Medio no disponible'; end if;
  select * into c from public.cursos where id = p_curso and estado = 'PUBLICADO' for no key update;
  if not found then raise exception 'Curso no disponible' using errcode = '22023'; end if;
  if not public.cumple_prerrequisito(p_estudiante, p_curso) then
    raise exception 'Debes completar primero el curso prerrequisito antes de inscribirte' using errcode = '22023';
  end if;
  if nullif(trim(p_cupon), '') is not null then
    select cu.* into cp from public.cupones cu where cu.codigo = upper(trim(p_cupon)) for update;
    if not found or not cp.activo or cp.fecha_vigencia < (now() at time zone 'America/Lima')::date then
      raise exception 'El cupón ya no está disponible. Revisa el importe antes de inscribirte.' using errcode = '22023';
    end if;
    select count(*) into usados from public.pagos pa join public.inscripciones ins on ins.id = pa.inscripcion_id
      where pa.cupon_id = cp.id and (pa.estado = 'APROBADO' or (pa.estado = 'PENDIENTE' and ins.estado = 'PENDIENTE' and (ins.vence_en is null or ins.vence_en > now())));
    if cp.usos_maximos is not null and usados >= cp.usos_maximos then
      raise exception 'El cupón agotó sus usos. Revisa el importe antes de inscribirte.' using errcode = '22023';
    end if;
  end if;
  importe = round(c.precio * (1 - coalesce(cp.porcentaje_descuento, 0) / 100), 2);
  if p_monto is null or importe <> p_monto then
    raise exception 'El precio cambió. Revisa el importe antes de inscribirte.' using errcode = '22023';
  end if;
  insert into public.inscripciones(estudiante_id, curso_id) values(p_estudiante, p_curso) returning * into i;
  insert into public.pagos(inscripcion_id, monto, metodo, cupon_id, datos_facturacion)
    values(i.id, importe, p_metodo, cp.id, p_facturacion) returning * into p;
  return query select i.id, i.codigo, i.vence_en, p.id, importe, cp.id;
end $$;
revoke all on function public.registrar_matricula(uuid,uuid,public.metodo_pago,text,numeric,jsonb) from public, anon, authenticated;
grant execute on function public.registrar_matricula(uuid,uuid,public.metodo_pago,text,numeric,jsonb) to service_role;

-- ---------------------------------------------------------------------
-- 2. HU-11 · RF-08 — resultado_academico NO se redefine aquí.
--    La versión security invoker de 20261001155751 ya sirve para la emisión
--    automática: service_role omite la RLS. Una versión security definer
--    que acepte current_user = 'postgres' deja leer notas ajenas, porque
--    dentro de la función current_user siempre es su dueño.
-- ---------------------------------------------------------------------

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
