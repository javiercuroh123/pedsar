-- =====================================================================
-- PEDSAR · Pruebas del resultado académico (nota final, asistencia y
-- avance) y de la verificación pública de certificados (HU-11).
-- =====================================================================
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

create schema pruebas;
create function pruebas.como(p_usuario uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_usuario, 'role', 'authenticated')::text, true);
end $$;
grant usage on schema pruebas to anon, authenticated;
grant execute on all functions in schema pruebas to anon, authenticated;

insert into auth.users (id, email, raw_user_meta_data) values
  ('a0000000-0000-4000-8000-000000000001', 'luis@pedsar.test', '{"nombres":"Luis","apellidos":"Ramos"}'),
  ('a0000000-0000-4000-8000-000000000002', 'ana@pedsar.test', '{"nombres":"Ana","apellidos":"Quispe"}'),
  ('a0000000-0000-4000-8000-000000000003', 'beto@pedsar.test', '{"nombres":"Beto","apellidos":"Ríos"}');
update public.perfiles set rol = 'instructor' where id = 'a0000000-0000-4000-8000-000000000001';

insert into public.cursos (id, slug, titulo, precio, duracion_horas, estado, instructor_id) values
  ('c0000000-0000-4000-8000-000000000001', 'prueba-excel', 'Excel', 180, 24, 'PUBLICADO', 'a0000000-0000-4000-8000-000000000001');
insert into public.inscripciones (id, estudiante_id, curso_id) values
  ('e0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001'),
  ('e0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001');
update public.inscripciones set estado = 'CONFIRMADA', vence_en = null;

-- Dos evaluaciones (sobre 20 y sobre 10), dos sesiones dictadas y una futura, tres contenidos.
insert into public.evaluaciones (id, curso_id, titulo, puntaje_total, intentos_permitidos) overriding system value values
  (90001, 'c0000000-0000-4000-8000-000000000001', 'Parcial', 20, 2),
  (90002, 'c0000000-0000-4000-8000-000000000001', 'Final', 10, 1);
insert into public.intentos_evaluacion (inscripcion_id, evaluacion_id, numero_intento, puntaje_obtenido) values
  ('e0000000-0000-4000-8000-000000000002', 90001, 1, 11),
  ('e0000000-0000-4000-8000-000000000002', 90001, 2, 16),
  ('e0000000-0000-4000-8000-000000000002', 90002, 1, 8),
  ('e0000000-0000-4000-8000-000000000003', 90001, 1, 18);
insert into public.sesiones (id, curso_id, fecha, hora_inicio) overriding system value values
  (90001, 'c0000000-0000-4000-8000-000000000001', current_date - 7, '19:00'),
  (90002, 'c0000000-0000-4000-8000-000000000001', current_date - 1, '19:00'),
  (90003, 'c0000000-0000-4000-8000-000000000001', current_date + 7, '19:00');
insert into public.asistencias (inscripcion_id, sesion_id, estado) values
  ('e0000000-0000-4000-8000-000000000002', 90001, 'PRESENTE'),
  ('e0000000-0000-4000-8000-000000000002', 90002, 'TARDANZA'),
  ('e0000000-0000-4000-8000-000000000003', 90001, 'AUSENTE');
insert into public.modulos (id, curso_id, titulo) overriding system value values (90001, 'c0000000-0000-4000-8000-000000000001', 'M1');
insert into public.contenidos (id, modulo_id, titulo, tipo, url_archivo) overriding system value values
  (90001, 90001, 'A', 'PDF', 'a.pdf'), (90002, 90001, 'B', 'PDF', 'b.pdf'), (90003, 90001, 'C', 'VIDEO', 'https://v');
insert into public.contenidos_completados (inscripcion_id, contenido_id) values ('e0000000-0000-4000-8000-000000000002', 90001);

-- ---------- resultado_academico ----------
create temp table r as select * from public.resultado_academico(array['e0000000-0000-4000-8000-000000000002'::uuid, 'e0000000-0000-4000-8000-000000000003'::uuid]);
select is((select nota_final from r where inscripcion_id = 'e0000000-0000-4000-8000-000000000002'), 16.00::numeric,
  'Nota final: promedio vigesimal de la mejor nota de cada evaluación ((16 + 8/10·20) / 2)');
select is((select rendidas from r where inscripcion_id = 'e0000000-0000-4000-8000-000000000002'), 2, 'Cuenta las evaluaciones rendidas');
select is((select nota_final from r where inscripcion_id = 'e0000000-0000-4000-8000-000000000003'), 9.00::numeric,
  'Las evaluaciones no rendidas cuentan 0 ((18 + 0) / 2)');
select is((select sesiones from r where inscripcion_id = 'e0000000-0000-4000-8000-000000000002'), 2, 'Solo cuentan las sesiones ya dictadas');
select is((select asistencia from r where inscripcion_id = 'e0000000-0000-4000-8000-000000000002'), 100.0::numeric, 'La tardanza cuenta como asistencia');
select is((select asistencia from r where inscripcion_id = 'e0000000-0000-4000-8000-000000000003'), 0.0::numeric, 'La ausencia no cuenta');
select is((select progreso from r where inscripcion_id = 'e0000000-0000-4000-8000-000000000002'), 33.3::numeric, 'Avance: 1 de 3 contenidos');

-- RLS: SECURITY INVOKER, cada uno ve solo lo suyo.
select pruebas.como('a0000000-0000-4000-8000-000000000003');
select results_eq($$select inscripcion_id from public.resultado_academico(array['e0000000-0000-4000-8000-000000000002'::uuid, 'e0000000-0000-4000-8000-000000000003'::uuid])$$,
  array['e0000000-0000-4000-8000-000000000003'::uuid], 'Un estudiante no obtiene el resultado de otro');
reset role;
select pruebas.como('a0000000-0000-4000-8000-000000000001');
select is((select count(*)::int from public.resultado_academico(array['e0000000-0000-4000-8000-000000000002'::uuid, 'e0000000-0000-4000-8000-000000000003'::uuid])), 2,
  'El instructor obtiene el resultado de sus estudiantes');
select throws_ok($$insert into public.certificados (inscripcion_id, codigo_unico) values ('e0000000-0000-4000-8000-000000000002', 'PED-2026-FALSO000')$$,
  '42501', null, 'El instructor no emite certificados (solo el administrador)');
reset role;

-- ---------- Verificación pública ----------
insert into public.certificados (inscripcion_id, codigo_unico, estudiante_nombre, curso_titulo, duracion_horas, instructor_nombre, nota_final, asistencia, motivo_excepcion) values
  ('e0000000-0000-4000-8000-000000000002', 'PED-2026-ABCDEFGH', 'Ana Quispe', 'Excel', 24, 'Luis Ramos', 16, 100, null),
  ('e0000000-0000-4000-8000-000000000003', 'PED-2026-JKLMNPQR', null, null, null, null, 9, 50, 'Faltas justificadas por descanso médico');
update public.perfiles set nombres = 'Ana María' where id = 'a0000000-0000-4000-8000-000000000002';

-- Visitante sin sesión: sin claims del usuario anterior.
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select results_eq($$select estudiante, curso, duracion_horas, nota_final, instructor from public.verificar_certificado(' ped-2026-abcdefgh ')$$,
  $$values ('Ana Quispe', 'Excel', 24, 16.00::numeric, 'Luis Ramos')$$,
  'El visitante verifica por código (sin importar mayúsculas) y ve los datos congelados al emitir');
select results_eq($$select estudiante, instructor from public.verificar_certificado('PED-2026-JKLMNPQR')$$,
  $$values ('Beto Ríos', 'Luis Ramos')$$, 'Un certificado sin datos congelados usa los actuales');
select is_empty($$select 1 from public.verificar_certificado('PED-0000-NOEXISTE')$$, 'Un código falso no verifica nada');
select is_empty($$select 1 from public.certificados$$, 'El visitante no lee la tabla de certificados (ni el motivo de excepción)');
reset role;

select * from finish();
rollback;
