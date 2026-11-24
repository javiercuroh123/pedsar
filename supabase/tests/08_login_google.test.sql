-- =====================================================================
-- PEDSAR · HU-45 Login con Google: el perfil toma el nombre que envía Google
-- =====================================================================
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users (id, email, raw_user_meta_data) values
  ('a8000000-0000-4000-8000-000000000001', 'rosa@gmail.test', '{"given_name":"Rosa","family_name":"Huamán","full_name":"Rosa Huamán"}'),
  ('a8000000-0000-4000-8000-000000000002', 'pedro@gmail.test', '{"full_name":"Pedro Soto"}'),
  ('a8000000-0000-4000-8000-000000000003', 'ana@pedsar.test', '{"nombres":"Ana","apellidos":"Quispe","given_name":"Otro"}'),
  ('a8000000-0000-4000-8000-000000000004', 'sin-datos@gmail.test', null);

select results_eq(
  $$select nombres, apellidos from public.perfiles where id = 'a8000000-0000-4000-8000-000000000001'$$,
  $$values ('Rosa'::text, 'Huamán'::text)$$,
  'Con given_name y family_name de Google se llenan nombres y apellidos'
);
select results_eq(
  $$select nombres, apellidos from public.perfiles where id = 'a8000000-0000-4000-8000-000000000002'$$,
  $$values ('Pedro Soto'::text, ''::text)$$,
  'Solo con full_name, el nombre completo va en nombres'
);
select results_eq(
  $$select nombres, apellidos from public.perfiles where id = 'a8000000-0000-4000-8000-000000000003'$$,
  $$values ('Ana'::text, 'Quispe'::text)$$,
  'El registro con formulario conserva sus nombres y apellidos'
);
select results_eq(
  $$select nombres, apellidos, rol::text from public.perfiles where id = 'a8000000-0000-4000-8000-000000000004'$$,
  $$values (''::text, ''::text, 'estudiante'::text)$$,
  'Sin metadatos se crea el perfil vacío de estudiante'
);

select * from finish();
rollback;
