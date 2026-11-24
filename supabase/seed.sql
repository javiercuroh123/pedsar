-- Datos de ejemplo para desarrollo (`npm run db:reset` en local, o pegar en el SQL Editor de Supabase).
-- Los usuarios se crean desde /registro; para volver admin o instructor a una cuenta:
--   update public.perfiles set rol = 'administrador' where correo = 'tu@correo.com';
--   update public.perfiles set rol = 'instructor'    where correo = 'otro@correo.com';
-- y luego asigna cursos:  update public.cursos set instructor_id = '<uuid del instructor>';
--
-- Las categorías y los 33 cursos reales los crea la migración
-- 20261117180000_catalogo_tecnologia_informatica.sql; aquí solo se agregan
-- módulos y horarios genéricos para probar el aula en local.

-- Tres módulos por curso
insert into public.modulos (curso_id, titulo, orden)
select c.id, m.titulo, m.orden
from public.cursos c
cross join (values ('Introducción y entorno de trabajo', 1), ('Fundamentos y práctica guiada', 2), ('Proyecto final', 3)) as m(titulo, orden)
where not exists (select 1 from public.modulos x where x.curso_id = c.id);

-- Ocho sesiones semanales por curso, empezando la próxima semana a las 19:00
insert into public.sesiones (curso_id, fecha, hora_inicio, duracion_minutos, modalidad, enlace_virtual)
select c.id,
       current_date + 7 + (s.n * 7) + (row_number() over (partition by s.n order by c.slug))::int % 5,
       '19:00', 120,
       'VIRTUAL'::public.tipo_sesion,
       'https://zoom.us/j/0000000000'
from public.cursos c
cross join generate_series(0, 7) as s(n)
where not exists (select 1 from public.sesiones x where x.curso_id = c.id);

insert into public.cupones (codigo, porcentaje_descuento, fecha_vigencia, usos_maximos) values
  ('BIENVENIDA10', 10, current_date + 90, null),
  ('PEDSAR15',     15, current_date + 30, 50)
on conflict (codigo) do nothing;
