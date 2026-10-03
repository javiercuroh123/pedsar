-- =====================================================================
-- PEDSAR · Pruebas de seguridad (RLS) por rol · RNF-04
-- Ejecutar con `npm run test:db` (Supabase local). Todo ocurre en una
-- transacción que se revierte al final.
-- =====================================================================
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

-- ---------- Ayudantes: cambiar de usuario como lo haría la API ----------
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

-- ---------- Datos: un admin, un instructor y dos estudiantes ----------
insert into auth.users (id, email, raw_user_meta_data) values
  ('a0000000-0000-4000-8000-000000000001', 'admin@pedsar.test', '{"nombres":"Admin"}'),
  ('a0000000-0000-4000-8000-000000000002', 'instructor@pedsar.test', '{"nombres":"Luis","apellidos":"Ramos"}'),
  ('a0000000-0000-4000-8000-000000000003', 'ana@pedsar.test', '{"nombres":"Ana"}'),
  ('a0000000-0000-4000-8000-000000000004', 'beto@pedsar.test', '{"nombres":"Beto"}');
update public.perfiles set rol = 'administrador' where id = 'a0000000-0000-4000-8000-000000000001';
update public.perfiles set rol = 'instructor' where id = 'a0000000-0000-4000-8000-000000000002';

insert into public.cursos (id, slug, titulo, precio, cupo_maximo, estado, instructor_id) values
  ('c0000000-0000-4000-8000-000000000001', 'prueba-excel', 'Excel', 180, 30, 'PUBLICADO', 'a0000000-0000-4000-8000-000000000002'),
  ('c0000000-0000-4000-8000-000000000002', 'prueba-borrador', 'Curso en borrador', 100, 30, 'BORRADOR', null);
insert into public.evaluaciones (id, curso_id, titulo) overriding system value values (90001, 'c0000000-0000-4000-8000-000000000001', 'Final');
insert into public.preguntas (evaluacion_id, enunciado, opciones, respuesta_correcta) values (90001, '¿Capital?', '["Lima","Cusco"]', 'Lima');
insert into public.cupones (codigo, porcentaje_descuento, fecha_vigencia) values ('PROMO', 10, '2999-12-31');
-- Beto ya está inscrito (lo crea el sistema, con su pago).
insert into public.inscripciones (id, estudiante_id, curso_id) values
  ('e0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000001');
insert into public.pagos (inscripcion_id, monto, metodo) values ('e0000000-0000-4000-8000-000000000004', 180, 'YAPE');

-- ---------- Visitante (anon) ----------
select pruebas.como_visitante();
-- (El seed de Supabase local trae otros cursos publicados: se miran solo los de la prueba.)
select results_eq($$select slug from public.cursos where id in ('c0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002')$$,
  array['prueba-excel'], 'El visitante solo ve los cursos publicados');
select is_empty($$select 1 from public.perfiles$$, 'El visitante no ve perfiles');
select is(public.cupo_disponible('c0000000-0000-4000-8000-000000000001'), 29, 'El visitante consulta el cupo disponible');
select results_eq($$select nombres from public.instructores_publicos(array['a0000000-0000-4000-8000-000000000002'::uuid, 'a0000000-0000-4000-8000-000000000003'::uuid])$$,
  array['Luis'], 'instructores_publicos solo expone instructores');
select throws_ok($$select privado.vencer_reservas()$$, '42501', null, 'El visitante no puede vencer reservas');
reset role;

-- ---------- Estudiante ----------
select pruebas.como('a0000000-0000-4000-8000-000000000003');
select results_eq($$select correo from public.perfiles$$, array['ana@pedsar.test'], 'El estudiante solo ve su propio perfil');
select is_empty($$select 1 from public.inscripciones$$, 'El estudiante no ve inscripciones ajenas');
select is_empty($$select 1 from public.pagos$$, 'El estudiante no ve pagos ajenos');
select lives_ok($$insert into public.inscripciones (estudiante_id, curso_id) values ('a0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001')$$,
  'El estudiante se inscribe a sí mismo');
select throws_ok($$insert into public.inscripciones (estudiante_id, curso_id) values ('a0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000002')$$,
  '42501', null, 'No puede inscribir a otro estudiante');
select throws_ok($$insert into public.inscripciones (estudiante_id, curso_id, estado) values ('a0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000002', 'CONFIRMADA')$$,
  '42501', null, 'No puede crear una inscripción ya confirmada');
select throws_ok($$insert into public.pagos (inscripcion_id, monto, metodo) values ('e0000000-0000-4000-8000-000000000004', 0, 'YAPE')$$,
  '42501', null, 'No puede registrar pagos (solo el servidor)');
select is_empty($$select 1 from public.preguntas$$, 'No puede leer las respuestas correctas de las evaluaciones');
select is_empty($$select 1 from public.cupones$$, 'No puede listar los cupones');
select is_empty($$select 1 from public.registro_actividad$$, 'No puede leer la auditoría');
-- Intenta cambiarse el rol, confirmarse la inscripción y aprobar su pago.
update public.perfiles set rol = 'administrador', estado = false where id = 'a0000000-0000-4000-8000-000000000003';
update public.inscripciones set estado = 'CONFIRMADA' where estudiante_id = 'a0000000-0000-4000-8000-000000000003';
update public.pagos set estado = 'APROBADO';
reset role;
select is((select rol::text || '/' || estado from public.perfiles where id = 'a0000000-0000-4000-8000-000000000003'), 'estudiante/true',
  'Un usuario no puede cambiarse el rol ni el estado');
select is((select estado::text from public.inscripciones where estudiante_id = 'a0000000-0000-4000-8000-000000000003'), 'PENDIENTE',
  'El estudiante no puede confirmar su propia inscripción');
select is((select estado::text from public.pagos where inscripcion_id = 'e0000000-0000-4000-8000-000000000004'), 'PENDIENTE',
  'El estudiante no puede aprobar pagos');

-- ---------- Instructor ----------
select pruebas.como('a0000000-0000-4000-8000-000000000002');
select is((select count(*)::int from public.inscripciones), 2, 'El instructor ve las inscripciones de sus cursos');
select results_eq($$select correo from public.perfiles$$, array['instructor@pedsar.test'], 'El instructor no lee los perfiles de los estudiantes');
select lives_ok($$insert into public.modulos (curso_id, titulo) values ('c0000000-0000-4000-8000-000000000001', 'Fórmulas')$$,
  'El instructor agrega módulos a su curso');
select throws_ok($$insert into public.modulos (curso_id, titulo) values ('c0000000-0000-4000-8000-000000000002', 'Ajeno')$$,
  '42501', null, 'El instructor no edita cursos ajenos');
select isnt_empty($$select 1 from public.preguntas$$, 'El instructor ve las preguntas de su curso');
reset role;

-- ---------- Administrador ----------
select pruebas.como('a0000000-0000-4000-8000-000000000001');
select is((select count(*)::int from public.perfiles), 4, 'El administrador ve todos los perfiles');
reset role;

select * from finish();
rollback;
