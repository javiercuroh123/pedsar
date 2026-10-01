-- =====================================================================
-- PEDSAR · Pruebas de matrícula: cupo (HU-17), reserva de 48 h,
-- vencimiento por pg_cron, reinscripción y N.º de operación único.
-- =====================================================================
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000001', 'ana@pedsar.test'),
  ('a0000000-0000-4000-8000-000000000002', 'beto@pedsar.test'),
  ('a0000000-0000-4000-8000-000000000003', 'carla@pedsar.test');
insert into public.cursos (id, slug, titulo, precio, cupo_maximo, estado) values
  ('c0000000-0000-4000-8000-000000000001', 'excel', 'Excel', 180, 2, 'PUBLICADO');

-- ---------- Reserva con plazo ----------
insert into public.inscripciones (id, estudiante_id, curso_id) values
  ('e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001');
insert into public.pagos (inscripcion_id, monto, metodo) values ('e0000000-0000-4000-8000-000000000001', 180, 'YAPE');

select ok((select vence_en between now() + interval '47 hours 59 minutes' and now() + interval '48 hours 1 minute'
           from public.inscripciones where id = 'e0000000-0000-4000-8000-000000000001'),
  'La base de datos fija el plazo de pago en 48 horas');
select is(public.cupo_disponible('c0000000-0000-4000-8000-000000000001'), 1, 'Una reserva vigente ocupa cupo');
select throws_ok($$insert into public.inscripciones (estudiante_id, curso_id) values ('a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001')$$,
  '23505', null, 'Un estudiante no tiene dos inscripciones activas en el mismo curso');

-- ---------- Cupo lleno ----------
insert into public.inscripciones (id, estudiante_id, curso_id) values
  ('e0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001');
select is(public.cupo_disponible('c0000000-0000-4000-8000-000000000001'), 0, 'El curso queda sin cupo');
select throws_ok($$insert into public.inscripciones (estudiante_id, curso_id) values ('a0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001')$$,
  'P0001', 'El curso no tiene cupos disponibles', 'No se puede inscribir sin cupo');

-- ---------- Una reserva vencida libera el cupo ----------
update public.inscripciones set vence_en = now() - interval '1 minute' where id = 'e0000000-0000-4000-8000-000000000001';
select is(public.cupo_disponible('c0000000-0000-4000-8000-000000000001'), 1, 'La reserva vencida deja de ocupar cupo aunque aún no se cancele');
select lives_ok($$insert into public.inscripciones (id, estudiante_id, curso_id) values ('e0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001')$$,
  'Carla ocupa el cupo liberado');
select is((select estado::text from public.inscripciones where id = 'e0000000-0000-4000-8000-000000000001'), 'CANCELADA',
  'Al inscribirse otro estudiante, la reserva vencida se cancela');
select is((select estado::text from public.pagos where inscripcion_id = 'e0000000-0000-4000-8000-000000000001'), 'VENCIDO',
  'Su pago pendiente queda VENCIDO');
select is((select count(*)::int from public.notificaciones where usuario_id = 'a0000000-0000-4000-8000-000000000001' and enlace = '/cursos/excel'), 1,
  'Se avisa al estudiante que su reserva venció');
select is((select count(*)::int from public.registro_actividad where accion = 'VENCER_RESERVA'), 1, 'El vencimiento queda en la auditoría');

-- ---------- pg_cron y reinscripción ----------
update public.inscripciones set vence_en = now() - interval '1 minute' where id = 'e0000000-0000-4000-8000-000000000002';
select is(privado.vencer_reservas(), 1, 'La tarea programada cancela las reservas vencidas de todos los cursos');
select is(privado.vencer_reservas(), 0, 'Volver a ejecutarla no cancela nada más');
select lives_ok($$insert into public.inscripciones (estudiante_id, curso_id) values ('a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001')$$,
  'Una inscripción cancelada no impide volver a inscribirse');
select is((select count(*)::int from cron.job where jobname = 'vencer-reservas' and schedule = '*/15 * * * *'), 1,
  'pg_cron ejecuta el vencimiento cada 15 minutos');

-- ---------- N.º de operación de Yape / Plin ----------
insert into public.pagos (inscripcion_id, monto, metodo, numero_operacion) values ('e0000000-0000-4000-8000-000000000003', 180, 'YAPE', '00123456');
select throws_ok($$insert into public.pagos (inscripcion_id, monto, metodo, numero_operacion) values ('e0000000-0000-4000-8000-000000000002', 180, 'YAPE', '00123456')$$,
  '23505', null, 'Un mismo N.º de operación de Yape no respalda dos pagos');
select lives_ok($$insert into public.pagos (inscripcion_id, monto, metodo, numero_operacion) values ('e0000000-0000-4000-8000-000000000002', 180, 'PLIN', '00123456')$$,
  'El mismo número en otra app (Plin) es otra operación');

select * from finish();
rollback;
