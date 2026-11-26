-- =====================================================================
-- PEDSAR · HU-34 · Biografía del instructor
-- Hasta 600 caracteres; pública solo para instructores activos.
-- =====================================================================
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email, raw_user_meta_data) values
  ('a1300000-0000-4000-8000-000000000001', 'profe13@pedsar.test',  '{"nombres":"Luis","apellidos":"Ramos"}'),
  ('a1300000-0000-4000-8000-000000000002', 'alumna13@pedsar.test', '{"nombres":"Ana","apellidos":"Quispe"}'),
  ('a1300000-0000-4000-8000-000000000003', 'inactivo13@pedsar.test', '{"nombres":"Raúl","apellidos":"Díaz"}');
update public.perfiles set rol = 'instructor' where id in ('a1300000-0000-4000-8000-000000000001', 'a1300000-0000-4000-8000-000000000003');
update public.perfiles set estado = false where id = 'a1300000-0000-4000-8000-000000000003';

select lives_ok($$
  update public.perfiles set biografia = 'Ingeniero de sistemas con 10 años enseñando ofimática y programación.'
  where id = 'a1300000-0000-4000-8000-000000000001'
$$, 'El instructor guarda su biografía');

select throws_ok($$
  update public.perfiles set biografia = repeat('x', 601) where id = 'a1300000-0000-4000-8000-000000000001'
$$, '23514', null, 'La biografía no pasa de 600 caracteres');

select throws_ok($$
  update public.perfiles set biografia = '   ' where id = 'a1300000-0000-4000-8000-000000000001'
$$, '23514', null, 'Una biografía en blanco se guarda como vacía (null), no como espacios');

update public.perfiles set biografia = 'Estudiante de prueba.' where id = 'a1300000-0000-4000-8000-000000000002';
update public.perfiles set biografia = 'Instructor dado de baja.' where id = 'a1300000-0000-4000-8000-000000000003';

set local role anon;
select results_eq(
  $$select biografia from public.instructores_publicos(array['a1300000-0000-4000-8000-000000000001'::uuid])$$,
  $$values ('Ingeniero de sistemas con 10 años enseñando ofimática y programación.'::text)$$,
  'Un visitante ve la biografía del instructor en el catálogo'
);
select is_empty(
  $$select * from public.instructores_publicos(array['a1300000-0000-4000-8000-000000000002'::uuid, 'a1300000-0000-4000-8000-000000000003'::uuid])$$,
  'No se publica la biografía de estudiantes ni de instructores inactivos'
);
select is_empty($$select biografia from public.perfiles$$, 'Pero no puede leer la tabla de perfiles directamente (RLS)');
reset role;

select * from finish();
rollback;
