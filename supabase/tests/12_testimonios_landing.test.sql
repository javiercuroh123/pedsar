-- =====================================================================
-- PEDSAR · HU-46 · Testimonios de la página de inicio
-- Solo reseñas reales visibles, de 4–5 estrellas, con texto, de cursos
-- publicados y una por estudiante; los ve cualquier visitante.
-- =====================================================================
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (id, email, raw_user_meta_data) values
  ('a1200000-0000-4000-8000-000000000001', 'ana12@pedsar.test',   '{"nombres":"Ana María","apellidos":"Quispe Rojas"}'),
  ('a1200000-0000-4000-8000-000000000002', 'beto12@pedsar.test',  '{"nombres":"Beto","apellidos":"Huamán"}'),
  ('a1200000-0000-4000-8000-000000000003', 'carla12@pedsar.test', '{"nombres":"Carla","apellidos":"Soto"}'),
  ('a1200000-0000-4000-8000-000000000004', 'dani12@pedsar.test',  '{"nombres":"Dani","apellidos":"Vega"}'),
  ('a1200000-0000-4000-8000-000000000005', 'eva12@pedsar.test',   '{"nombres":"Eva","apellidos":"Paz"}'),
  ('a1200000-0000-4000-8000-000000000006', 'fio12@pedsar.test',   '{"nombres":"Fiorella","apellidos":"Luna"}');

insert into public.cursos (id, slug, titulo, precio, duracion_horas, estado) values
  ('c1200000-0000-4000-8000-000000000001', 'prueba-testimonios-excel', 'Excel 12', 150, 24, 'PUBLICADO'),
  ('c1200000-0000-4000-8000-000000000002', 'prueba-testimonios-redes', 'Redes 12', 150, 24, 'PUBLICADO'),
  ('c1200000-0000-4000-8000-000000000003', 'prueba-testimonios-viejo', 'Viejo 12', 150, 24, 'DESPUBLICADO');

-- Inscripción n.º k: estudiante y curso de cada reseña.
insert into public.inscripciones (id, estudiante_id, curso_id) values
  ('e1200000-0000-4000-8000-000000000001', 'a1200000-0000-4000-8000-000000000001', 'c1200000-0000-4000-8000-000000000001'),
  ('e1200000-0000-4000-8000-000000000002', 'a1200000-0000-4000-8000-000000000001', 'c1200000-0000-4000-8000-000000000002'),
  ('e1200000-0000-4000-8000-000000000003', 'a1200000-0000-4000-8000-000000000002', 'c1200000-0000-4000-8000-000000000001'),
  ('e1200000-0000-4000-8000-000000000004', 'a1200000-0000-4000-8000-000000000003', 'c1200000-0000-4000-8000-000000000001'),
  ('e1200000-0000-4000-8000-000000000005', 'a1200000-0000-4000-8000-000000000004', 'c1200000-0000-4000-8000-000000000001'),
  ('e1200000-0000-4000-8000-000000000006', 'a1200000-0000-4000-8000-000000000005', 'c1200000-0000-4000-8000-000000000003'),
  ('e1200000-0000-4000-8000-000000000007', 'a1200000-0000-4000-8000-000000000006', 'c1200000-0000-4000-8000-000000000002');
update public.inscripciones set estado = 'CONFIRMADA', vence_en = null where id::text like 'e1200000%';

insert into public.resenas (inscripcion_id, estudiante_id, curso_id, estrellas, texto) values
  ('e1200000-0000-4000-8000-000000000001', 'a1200000-0000-4000-8000-000000000001', 'c1200000-0000-4000-8000-000000000001', 5, '  Aprendí tablas dinámicas y ya las uso en mi trabajo.  '),
  ('e1200000-0000-4000-8000-000000000002', 'a1200000-0000-4000-8000-000000000001', 'c1200000-0000-4000-8000-000000000002', 4, 'Buen curso de redes, con muchas prácticas.'),
  ('e1200000-0000-4000-8000-000000000003', 'a1200000-0000-4000-8000-000000000002', 'c1200000-0000-4000-8000-000000000001', 3, 'Estuvo bien, aunque esperaba más ejercicios.'),
  ('e1200000-0000-4000-8000-000000000004', 'a1200000-0000-4000-8000-000000000003', 'c1200000-0000-4000-8000-000000000001', 5, 'Excelente, lo recomiendo a todos mis amigos.'),
  ('e1200000-0000-4000-8000-000000000005', 'a1200000-0000-4000-8000-000000000004', 'c1200000-0000-4000-8000-000000000001', 5, 'Muy bueno'),
  ('e1200000-0000-4000-8000-000000000006', 'a1200000-0000-4000-8000-000000000005', 'c1200000-0000-4000-8000-000000000003', 5, 'Un curso que ya no se dicta, pero fue genial.'),
  ('e1200000-0000-4000-8000-000000000007', 'a1200000-0000-4000-8000-000000000006', 'c1200000-0000-4000-8000-000000000002', 4, 'El instructor explica con mucha paciencia.');
-- El administrador ocultó la reseña de Carla.
update public.resenas set oculta = true where inscripcion_id = 'e1200000-0000-4000-8000-000000000004';

select results_eq(
  $$select autor, estrellas::int, texto, curso from public.testimonios_publicos(10) where curso like '% 12'$$,
  $$values ('Ana Q.', 5, 'Aprendí tablas dinámicas y ya las uso en mi trabajo.', 'Excel 12'),
           ('Fiorella L.', 4, 'El instructor explica con mucha paciencia.', 'Redes 12')$$,
  'Solo reseñas visibles de 4–5 estrellas, con texto y de cursos publicados, una por estudiante y las mejores primero'
);

select is((select count(*)::int from public.testimonios_publicos(10) where autor = 'Ana Q.'), 1, 'Cada estudiante aparece una sola vez');
select is((select count(*)::int from public.testimonios_publicos(1)), 1, 'Respeta el límite pedido');

set local role anon;
select is((select count(*)::int from public.testimonios_publicos(10) where curso like '% 12'), 2, 'Un visitante sin sesión ve los testimonios');
select is_empty($$select * from public.resenas$$, 'Pero no puede leer la tabla de reseñas directamente (RLS)');
reset role;

select * from finish();
rollback;
