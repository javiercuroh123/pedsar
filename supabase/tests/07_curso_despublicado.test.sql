-- =====================================================================
-- PEDSAR · Un curso despublicado sigue visible para quien ya está inscrito
-- Antes, la RLS de cursos solo dejaba leer los PUBLICADO: al despublicar un
-- curso, sus alumnos confirmados recibían la inscripción sin curso y el panel
-- del estudiante fallaba. Contenidos, sesiones y evaluaciones ya se leían con
-- privado.esta_inscrito_en(); el curso debe seguir la misma regla.
-- =====================================================================
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

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

insert into auth.users (id, email, raw_user_meta_data) values
  ('a7000000-0000-4000-8000-000000000001', 'inscrita@pedsar.test', '{"nombres":"Inés"}'),
  ('a7000000-0000-4000-8000-000000000002', 'ajeno@pedsar.test', '{"nombres":"Óscar"}');

insert into public.cursos (id, slug, titulo, precio, cupo_maximo, estado) values
  ('c7000000-0000-4000-8000-000000000001', 'prueba-despublicado', 'Curso despublicado', 100, 30, 'PUBLICADO');
insert into public.modulos (id, curso_id, titulo) overriding system value values
  (97001, 'c7000000-0000-4000-8000-000000000001', 'Módulo 1');
insert into public.inscripciones (id, estudiante_id, curso_id, estado) values
  ('e7000000-0000-4000-8000-000000000001', 'a7000000-0000-4000-8000-000000000001', 'c7000000-0000-4000-8000-000000000001', 'CONFIRMADA');
update public.cursos set estado = 'DESPUBLICADO' where id = 'c7000000-0000-4000-8000-000000000001';

-- Alumna inscrita: ve el curso, su módulo y el curso embebido en su inscripción.
select pruebas.como('a7000000-0000-4000-8000-000000000001');
select results_eq($$select titulo from public.cursos where id = 'c7000000-0000-4000-8000-000000000001'$$,
  array['Curso despublicado'], 'La alumna inscrita sigue viendo el curso despublicado');
select results_eq($$select c.titulo from public.inscripciones i left join public.cursos c on c.id = i.curso_id
                    where i.id = 'e7000000-0000-4000-8000-000000000001'$$,
  array['Curso despublicado'], 'Su inscripción no queda sin curso');
select results_eq($$select titulo from public.modulos where curso_id = 'c7000000-0000-4000-8000-000000000001'$$,
  array['Módulo 1'], 'La alumna inscrita sigue viendo los módulos del curso');
reset role;

-- Estudiante no inscrito y visitante: no ven el curso despublicado.
select pruebas.como('a7000000-0000-4000-8000-000000000002');
select is_empty($$select 1 from public.cursos where id = 'c7000000-0000-4000-8000-000000000001'$$,
  'Un estudiante no inscrito no ve el curso despublicado');
reset role;
select pruebas.como_visitante();
select is_empty($$select 1 from public.cursos where id = 'c7000000-0000-4000-8000-000000000001'$$,
  'El visitante no ve el curso despublicado');
reset role;

select * from finish();
rollback;
