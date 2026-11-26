-- =====================================================================
-- PEDSAR · HU-56 · Faltas justificadas con motivo
-- La justificada exige motivo y cuenta como asistencia para el 75 %.
-- =====================================================================
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

select enum_has_labels('public', 'estado_asistencia', array['PRESENTE', 'AUSENTE', 'TARDANZA', 'JUSTIFICADA'],
  'La asistencia puede ser presente, ausente, tardanza o justificada');

insert into auth.users (id, email, raw_user_meta_data) values
  ('a1100000-0000-4000-8000-000000000001', 'profe11@pedsar.test', '{"nombres":"Luis","apellidos":"Ramos"}'),
  ('a1100000-0000-4000-8000-000000000002', 'alumna11@pedsar.test', '{"nombres":"Ana","apellidos":"Quispe"}');
update public.perfiles set rol = 'instructor' where id = 'a1100000-0000-4000-8000-000000000001';
insert into public.cursos (id, slug, titulo, precio, duracion_horas, estado, instructor_id) values
  ('c1100000-0000-4000-8000-000000000001', 'prueba-justificadas', 'Excel', 150, 24, 'PUBLICADO', 'a1100000-0000-4000-8000-000000000001');
insert into public.inscripciones (id, estudiante_id, curso_id) values
  ('e1100000-0000-4000-8000-000000000001', 'a1100000-0000-4000-8000-000000000002', 'c1100000-0000-4000-8000-000000000001');
update public.inscripciones set estado = 'CONFIRMADA', vence_en = null where id = 'e1100000-0000-4000-8000-000000000001';
insert into public.sesiones (id, curso_id, fecha, hora_inicio, modalidad) overriding system value
select 99110 + n, 'c1100000-0000-4000-8000-000000000001', current_date - n, '19:00', 'VIRTUAL'
from generate_series(1, 4) n;

select throws_ok($$
  insert into public.asistencias (inscripcion_id, sesion_id, estado) values ('e1100000-0000-4000-8000-000000000001', 99111, 'JUSTIFICADA')
$$, '23514', null, 'Una falta justificada exige motivo');

select throws_ok($$
  insert into public.asistencias (inscripcion_id, sesion_id, estado, motivo) values ('e1100000-0000-4000-8000-000000000001', 99111, 'JUSTIFICADA', '  ')
$$, '23514', null, 'El motivo no puede estar en blanco');

select throws_ok($$
  insert into public.asistencias (inscripcion_id, sesion_id, estado, motivo) values ('e1100000-0000-4000-8000-000000000001', 99111, 'AUSENTE', 'Viaje')
$$, '23514', null, 'Solo las faltas justificadas llevan motivo');

select lives_ok($$
  insert into public.asistencias (inscripcion_id, sesion_id, estado, motivo) values
    ('e1100000-0000-4000-8000-000000000001', 99111, 'JUSTIFICADA', 'Cita médica con constancia'),
    ('e1100000-0000-4000-8000-000000000001', 99112, 'PRESENTE', null),
    ('e1100000-0000-4000-8000-000000000001', 99113, 'TARDANZA', null),
    ('e1100000-0000-4000-8000-000000000001', 99114, 'AUSENTE', null)
$$, 'Se registra una falta justificada con su motivo');

-- 3 de 4 sesiones cuentan como asistidas (presente, tardanza y justificada).
select results_eq(
  $$select sesiones, presentes, asistencia from public.resultado_academico(array['e1100000-0000-4000-8000-000000000001'::uuid])$$,
  $$values (4, 3, 75.0::numeric)$$,
  'La falta justificada cuenta como asistencia para el porcentaje'
);

select lives_ok($$
  update public.asistencias set estado = 'PRESENTE', motivo = null
  where inscripcion_id = 'e1100000-0000-4000-8000-000000000001' and sesion_id = 99111
$$, 'Al cambiar a presente se borra el motivo');

select * from finish();
rollback;
