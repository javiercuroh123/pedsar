-- =====================================================================
-- PEDSAR · Cursos solo virtuales y HU-16 (sesiones en vivo o asíncronas)
-- La asíncrona se publica en el horario, pero no registra asistencia,
-- no cuenta para el porcentaje de asistencia ni genera recordatorio.
-- =====================================================================
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

select enum_has_labels('public', 'tipo_sesion', array['VIRTUAL', 'ASINCRONA'],
  'Una sesión es virtual en vivo o asíncrona');

insert into auth.users (id, email, raw_user_meta_data) values
  ('a9000000-0000-4000-8000-000000000001', 'profe@pedsar.test', '{"nombres":"Luis","apellidos":"Ramos"}'),
  ('a9000000-0000-4000-8000-000000000002', 'alumna@pedsar.test', '{"nombres":"Ana","apellidos":"Quispe"}');
update public.perfiles set rol = 'instructor' where id = 'a9000000-0000-4000-8000-000000000001';

insert into public.cursos (id, slug, titulo, precio, duracion_horas, estado, instructor_id) values
  ('c9000000-0000-4000-8000-000000000001', 'prueba-asincrona', 'Python', 150, 24, 'PUBLICADO', 'a9000000-0000-4000-8000-000000000001');
insert into public.inscripciones (id, estudiante_id, curso_id) values
  ('e9000000-0000-4000-8000-000000000001', 'a9000000-0000-4000-8000-000000000002', 'c9000000-0000-4000-8000-000000000001');
update public.inscripciones set estado = 'CONFIRMADA', vence_en = null where id = 'e9000000-0000-4000-8000-000000000001';

select throws_ok($$
  insert into public.cursos (slug, titulo, precio, duracion_horas, modalidad) values ('prueba-presencial', 'Taller', 100, 8, 'PRESENCIAL')
$$, '23514', null, 'Un curso no puede ser presencial');
select throws_ok($$
  update public.cursos set modalidad = 'SEMIPRESENCIAL' where id = 'c9000000-0000-4000-8000-000000000001'
$$, '23514', null, 'Un curso no puede pasar a semipresencial');

select lives_ok($$
  insert into public.sesiones (id, curso_id, fecha, hora_inicio, modalidad, enlace_virtual) overriding system value values
    (99001, 'c9000000-0000-4000-8000-000000000001', current_date - 2, '19:00', 'VIRTUAL', 'https://meet.test/clase'),
    (99002, 'c9000000-0000-4000-8000-000000000001', current_date - 1, '19:00', 'ASINCRONA', 'https://video.test/grabacion')
$$, 'Se programa una sesión asíncrona con el enlace de su grabación');

insert into public.asistencias (inscripcion_id, sesion_id, estado) values
  ('e9000000-0000-4000-8000-000000000001', 99001, 'PRESENTE');

select throws_ok($$
  insert into public.asistencias (inscripcion_id, sesion_id, estado) values ('e9000000-0000-4000-8000-000000000001', 99002, 'AUSENTE')
$$, '23514', 'Las sesiones asíncronas no registran asistencia', 'No se registra asistencia en una sesión asíncrona');

select results_eq(
  $$select sesiones, asistencia from public.resultado_academico(array['e9000000-0000-4000-8000-000000000001'::uuid])$$,
  $$values (1, 100.0::numeric)$$,
  'La sesión asíncrona no cuenta para el porcentaje de asistencia'
);

set local role anon;
select results_eq(
  $$select modalidad::text from public.horarios_publicos(array['c9000000-0000-4000-8000-000000000001'::uuid]) order by fecha$$,
  $$values ('VIRTUAL'::text), ('ASINCRONA'::text)$$,
  'El horario público muestra el tipo de cada sesión'
);
reset role;

-- Recordatorio «inicia en 1 hora»: solo para la sesión sincrónica.
insert into public.sesiones (id, curso_id, fecha, hora_inicio, modalidad) overriding system value
select v.id, 'c9000000-0000-4000-8000-000000000001', (t at time zone 'America/Lima')::date, (t at time zone 'America/Lima')::time, v.m::public.tipo_sesion
from (select now() + interval '30 minutes' as t) x
cross join (values (99003, 'VIRTUAL'), (99004, 'ASINCRONA')) as v(id, m);

select ok(privado.generar_recordatorios_programados() >= 1, 'Se generan los recordatorios pendientes');
select is(
  (select count(*)::int from public.recordatorios_enviados where tipo_evento = 'SESION_1H' and referencia_id = 99003),
  1, 'La sesión virtual próxima recibe su recordatorio'
);
select is(
  (select count(*)::int from public.recordatorios_enviados where tipo_evento = 'SESION_1H' and referencia_id = 99004),
  0, 'La sesión asíncrona no genera recordatorio de inicio'
);

select * from finish();
rollback;
