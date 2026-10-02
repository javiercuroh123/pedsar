-- =====================================================================
-- PEDSAR · Pruebas de la comunidad: mensajería estudiante–instructor
-- (HU-19) y reseñas de cursos (HU-24). RLS, elegibilidad y moderación.
-- =====================================================================
begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

create schema pruebas;
create function pruebas.como(p_usuario uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_usuario, 'role', 'authenticated')::text, true);
end $$;
create function pruebas.como_visitante() returns void language plpgsql as $$
begin
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
end $$;
grant usage on schema pruebas to anon, authenticated;
grant execute on all functions in schema pruebas to anon, authenticated;

-- Luis dicta Excel; Ana y Beto están matriculados, Carla solo reservó; hay un administrador.
insert into auth.users (id, email, raw_user_meta_data) values
  ('a0000000-0000-4000-8000-000000000001', 'luis@pedsar.test', '{"nombres":"Luis","apellidos":"Ramos"}'),
  ('a0000000-0000-4000-8000-000000000002', 'ana@pedsar.test', '{"nombres":"Ana","apellidos":"Quispe Rojas"}'),
  ('a0000000-0000-4000-8000-000000000003', 'beto@pedsar.test', '{"nombres":"Beto","apellidos":"Paz"}'),
  ('a0000000-0000-4000-8000-000000000004', 'carla@pedsar.test', '{"nombres":"Carla"}'),
  ('a0000000-0000-4000-8000-000000000005', 'admin@pedsar.test', '{"nombres":"Admin"}');
update public.perfiles set rol = 'instructor' where id = 'a0000000-0000-4000-8000-000000000001';
update public.perfiles set rol = 'administrador' where id = 'a0000000-0000-4000-8000-000000000005';
insert into public.cursos (id, slug, titulo, precio, cupo_maximo, estado, instructor_id) values
  ('c0000000-0000-4000-8000-000000000001', 'prueba-excel', 'Excel', 180, 30, 'PUBLICADO', 'a0000000-0000-4000-8000-000000000001');
insert into public.inscripciones (id, estudiante_id, curso_id, estado) values
  ('e0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', 'CONFIRMADA'),
  ('e0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001', 'CONFIRMADA'),
  ('e0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000001', 'PENDIENTE');

-- ---------- Conversaciones ----------
select pruebas.como('a0000000-0000-4000-8000-000000000002');
select lives_ok($$insert into public.conversaciones (curso_id, estudiante_id)
                  values ('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002')$$,
  'Una estudiante matriculada abre la conversación con el instructor de su curso');
select throws_ok($$insert into public.conversaciones (curso_id, estudiante_id)
                   values ('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003')$$,
  '42501', null, 'Nadie abre una conversación a nombre de otro estudiante');
select pruebas.como('a0000000-0000-4000-8000-000000000004');
select throws_ok($$insert into public.conversaciones (curso_id, estudiante_id)
                   values ('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000004')$$,
  '42501', null, 'Sin la matrícula confirmada no se puede escribir al instructor');

-- ---------- Mensajes ----------
select pruebas.como('a0000000-0000-4000-8000-000000000002');
select lives_ok($$insert into public.mensajes (conversacion_id, autor_id, texto)
                  values ((select id from public.conversaciones where estudiante_id = 'a0000000-0000-4000-8000-000000000002'),
                          'a0000000-0000-4000-8000-000000000002', '¿Hasta cuándo es la entrega?')$$,
  'La estudiante envía un mensaje');
select throws_ok($$insert into public.mensajes (conversacion_id, autor_id, texto)
                   values ((select id from public.conversaciones where estudiante_id = 'a0000000-0000-4000-8000-000000000002'),
                           'a0000000-0000-4000-8000-000000000002', '   ')$$,
  '23514', null, 'Un mensaje con solo espacios no se acepta');
select throws_ok($$insert into public.mensajes (conversacion_id, autor_id, texto)
                   values ((select id from public.conversaciones where estudiante_id = 'a0000000-0000-4000-8000-000000000002'),
                           'a0000000-0000-4000-8000-000000000001', 'Suplantando al instructor')$$,
  '42501', null, 'Nadie escribe a nombre de otro');

select pruebas.como('a0000000-0000-4000-8000-000000000001');
select is((select count(*)::int from public.mensajes), 1, 'El instructor del curso lee el mensaje');
select lives_ok($$insert into public.mensajes (conversacion_id, autor_id, texto)
                  values ((select id from public.conversaciones where estudiante_id = 'a0000000-0000-4000-8000-000000000002'),
                          'a0000000-0000-4000-8000-000000000001', 'El viernes a las 23:59')$$,
  'El instructor responde');

select pruebas.como('a0000000-0000-4000-8000-000000000003');
select is((select count(*)::int from public.mensajes), 0, 'Otro estudiante no lee la conversación ajena');
select pruebas.como('a0000000-0000-4000-8000-000000000005');
select is((select count(*)::int from public.mensajes), 0, 'El administrador no lee los chats privados');

reset role;
select ok((select ultimo_mensaje_en from public.conversaciones where estudiante_id = 'a0000000-0000-4000-8000-000000000002')
          >= (select max(enviado_en) from public.mensajes),
  'La conversación registra la hora del último mensaje');

-- ---------- Lectura ----------
select pruebas.como('a0000000-0000-4000-8000-000000000003');
select is(public.marcar_leidos((select id from public.conversaciones where estudiante_id = 'a0000000-0000-4000-8000-000000000002')), 0,
  'Quien no participa no marca nada como leído');
select pruebas.como('a0000000-0000-4000-8000-000000000002');
select is(public.marcar_leidos((select id from public.conversaciones where estudiante_id = 'a0000000-0000-4000-8000-000000000002')), 1,
  'La estudiante marca como leído el mensaje del instructor');
reset role;
select is((select count(*)::int from public.mensajes where autor_id = 'a0000000-0000-4000-8000-000000000002' and leido_en is null), 1,
  'Su propio mensaje sigue sin leer para el instructor');

-- Los lados son «la estudiante» y «el instructor del curso»: si se reasigna el curso, la nueva
-- instructora no marca como leída la respuesta pendiente del instructor anterior.
select pruebas.como('a0000000-0000-4000-8000-000000000001');
insert into public.mensajes (conversacion_id, autor_id, texto)
  values ((select id from public.conversaciones where estudiante_id = 'a0000000-0000-4000-8000-000000000002'),
          'a0000000-0000-4000-8000-000000000001', 'Recuerda subir el archivo en Excel');
reset role;
insert into auth.users (id, email, raw_user_meta_data) values ('a0000000-0000-4000-8000-000000000006', 'marta@pedsar.test', '{"nombres":"Marta"}');
update public.perfiles set rol = 'instructor' where id = 'a0000000-0000-4000-8000-000000000006';
update public.cursos set instructor_id = 'a0000000-0000-4000-8000-000000000006' where id = 'c0000000-0000-4000-8000-000000000001';
select pruebas.como('a0000000-0000-4000-8000-000000000006');
select is(public.marcar_leidos((select id from public.conversaciones where estudiante_id = 'a0000000-0000-4000-8000-000000000002')), 1,
  'Tras reasignar el curso, la nueva instructora solo marca como leídos los mensajes de la estudiante');
reset role;
select is((select count(*)::int from public.mensajes where autor_id = 'a0000000-0000-4000-8000-000000000001' and leido_en is null), 1,
  'La respuesta del instructor anterior sigue sin leer para la estudiante');
update public.cursos set instructor_id = 'a0000000-0000-4000-8000-000000000001' where id = 'c0000000-0000-4000-8000-000000000001';

-- ---------- Reseñas ----------
select pruebas.como('a0000000-0000-4000-8000-000000000002');
select throws_ok($$insert into public.resenas (inscripcion_id, estrellas) values ('e0000000-0000-4000-8000-000000000002', 5)$$,
  '42501', null, 'No se califica un curso que aún no se completa');
reset role;
insert into public.progreso (inscripcion_id, porcentaje, lecciones_completadas, total_lecciones) values ('e0000000-0000-4000-8000-000000000002', 100, 8, 8);
select pruebas.como('a0000000-0000-4000-8000-000000000002');
select lives_ok($$insert into public.resenas (inscripcion_id, estrellas, texto) values ('e0000000-0000-4000-8000-000000000002', 4, 'Muy práctico')$$,
  'Con el 100 % de avance se puede calificar');
select throws_ok($$insert into public.resenas (inscripcion_id, estrellas) values ('e0000000-0000-4000-8000-000000000002', 3)$$,
  '23505', null, 'Una sola reseña por inscripción');
reset role;
select is((select estudiante_id from public.resenas where inscripcion_id = 'e0000000-0000-4000-8000-000000000002'),
  'a0000000-0000-4000-8000-000000000002'::uuid, 'El curso y el autor se toman de la inscripción');

insert into public.certificados (inscripcion_id, codigo_unico) values ('e0000000-0000-4000-8000-000000000003', 'PED-2026-COMUNIDA');
select pruebas.como('a0000000-0000-4000-8000-000000000003');
select lives_ok($$insert into public.resenas (inscripcion_id, estrellas) values ('e0000000-0000-4000-8000-000000000003', 2)$$,
  'Con el certificado emitido también se puede calificar');

select pruebas.como('a0000000-0000-4000-8000-000000000002');
update public.resenas set oculta = true, estrellas = 5 where inscripcion_id = 'e0000000-0000-4000-8000-000000000002';
update public.resenas set oculta = false, estrellas = 4 where inscripcion_id = 'e0000000-0000-4000-8000-000000000002';
select pruebas.como('a0000000-0000-4000-8000-000000000005');
update public.resenas set oculta = true where inscripcion_id = 'e0000000-0000-4000-8000-000000000003';
select pruebas.como('a0000000-0000-4000-8000-000000000003');
update public.resenas set oculta = false where inscripcion_id = 'e0000000-0000-4000-8000-000000000003';
reset role;
select is((select oculta from public.resenas where inscripcion_id = 'e0000000-0000-4000-8000-000000000003'), true,
  'El administrador oculta una reseña y el estudiante no puede volver a mostrarla');

select is((select cantidad from public.calificacion_cursos(array['c0000000-0000-4000-8000-000000000001'::uuid])), 1,
  'Las reseñas ocultas no cuentan');
select is((select promedio from public.calificacion_cursos(array['c0000000-0000-4000-8000-000000000001'::uuid])), 4.0,
  'El promedio usa las estrellas visibles');
select results_eq($$select estrellas::int, texto, autor from public.resenas_publicas('c0000000-0000-4000-8000-000000000001')$$,
  $$values (4, 'Muy práctico', 'Ana Q.')$$, 'Las reseñas públicas muestran solo el nombre y la inicial del apellido');

select pruebas.como_visitante();
select is((select count(*)::int from public.resenas), 0, 'Un visitante no lee la tabla de reseñas');
select is((select cantidad from public.calificacion_cursos(array['c0000000-0000-4000-8000-000000000001'::uuid])), 1,
  'Pero sí ve el promedio del curso');
reset role;

select * from finish();
rollback;
