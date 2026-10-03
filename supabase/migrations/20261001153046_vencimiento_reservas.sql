-- =====================================================================
-- PEDSAR · Reinscripción y vencimiento de reservas
-- Diagrama de secuencia, pasos 23-25 (pago rechazado → inscripción
-- cancelada) y diagrama de actividad (anular la inscripción). Una
-- inscripción pendiente reserva cupo solo durante el plazo de pago.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Una sola inscripción ACTIVA por estudiante y curso. Las canceladas
--    (pago rechazado, reembolso o reserva vencida) quedan como historial
--    y ya no impiden volver a inscribirse.
-- ---------------------------------------------------------------------
alter table public.inscripciones drop constraint inscripciones_estudiante_id_curso_id_key;
create unique index inscripciones_activa_unica on public.inscripciones (estudiante_id, curso_id)
  where estado <> 'CANCELADA';

-- ---------------------------------------------------------------------
-- 2. Plazo de pago de la reserva (el estado de pago VENCIDO se agrega en
--    la migración anterior: un valor de enum no se puede usar en la misma
--    transacción en que se crea)
-- ---------------------------------------------------------------------
alter table public.inscripciones add column vence_en timestamptz;
comment on column public.inscripciones.vence_en is
  'Fin del plazo para registrar el pago de una inscripción PENDIENTE; null mientras el pago está en validación.';

-- El cupo libre ya no cuenta las reservas vencidas, aunque todavía no se hayan cancelado.
create or replace function public.cupo_disponible(p_curso uuid)
returns int language sql stable security definer set search_path = '' as $$
  select c.cupo_maximo - count(i.id)::int
  from public.cursos c
  left join public.inscripciones i
    on i.curso_id = c.id
   and i.estado <> 'CANCELADA'
   and not (i.estado = 'PENDIENTE' and i.vence_en is not null and i.vence_en <= now())
  where c.id = p_curso
  group by c.cupo_maximo
$$;

-- Cancela las reservas vencidas (de un curso o de todos), marca su pago
-- como VENCIDO, avisa al estudiante y deja constancia en la auditoría.
-- La ejecutan pg_cron (todos los cursos) y el trigger de inscripción (un curso).
create function privado.vencer_reservas(p_curso uuid default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  canceladas integer;
begin
  with ins as (
    update public.inscripciones i
       set estado = 'CANCELADA'
     where i.estado = 'PENDIENTE'
       and i.vence_en <= now()
       and (p_curso is null or i.curso_id = p_curso)
    returning i.id, i.codigo, i.estudiante_id, i.curso_id
  ), pag as (
    update public.pagos p
       set estado = 'VENCIDO'
      from ins
     where p.inscripcion_id = ins.id and p.estado = 'PENDIENTE'
    returning p.id
  ), avisos as (
    insert into public.notificaciones (usuario_id, mensaje, enlace)
    select ins.estudiante_id,
           format('Tu reserva en %s venció porque no registraste el pago a tiempo. Si aún hay cupos, puedes volver a inscribirte.', c.titulo),
           '/cursos/' || c.slug
      from ins join public.cursos c on c.id = ins.curso_id
    returning id
  ), auditoria as (
    insert into public.registro_actividad (usuario_id, accion, detalle)
    select null, 'VENCER_RESERVA', jsonb_build_object('inscripcion', ins.codigo)
      from ins
    returning id
  )
  select count(*) into canceladas from ins;
  return canceladas;
end $$;

revoke execute on function privado.vencer_reservas(uuid) from public, anon;
grant execute on function privado.vencer_reservas(uuid) to authenticated, service_role;

-- Inscripcion.verificarCupo(): antes de validar el cupo se liberan las
-- reservas vencidas del curso (incluida una anterior del mismo estudiante)
-- y el plazo lo fija la base de datos, no el navegador.
create or replace function public.validar_cupo_inscripcion()
returns trigger language plpgsql set search_path = '' as $$
begin
  perform privado.vencer_reservas(new.curso_id);
  if coalesce(public.cupo_disponible(new.curso_id), 0) <= 0 then
    raise exception 'El curso no tiene cupos disponibles' using errcode = 'P0001';
  end if;
  -- Plazo de pago: 48 horas (PLAZO_PAGO_HORAS en src/config/matricula.ts).
  new.vence_en = case when new.estado = 'PENDIENTE' then now() + interval '48 hours' end;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 3. Tarea programada: cada 15 minutos cierra las reservas vencidas.
-- ---------------------------------------------------------------------
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('vencer-reservas', '*/15 * * * *', 'select privado.vencer_reservas()');
