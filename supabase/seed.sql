-- Datos de ejemplo para desarrollo (`npm run db:reset` en local, o pegar en el SQL Editor de Supabase).
-- Los usuarios se crean desde /registro; para volver admin o instructor a una cuenta:
--   update public.perfiles set rol = 'administrador' where correo = 'tu@correo.com';
--   update public.perfiles set rol = 'instructor'    where correo = 'otro@correo.com';
-- y luego asigna cursos:  update public.cursos set instructor_id = '<uuid del instructor>';

insert into public.categorias (nombre, slug, descripcion) values
  ('Programación',            'programacion',            'Lógica, Python y fundamentos de software'),
  ('Desarrollo web',          'desarrollo-web',          'HTML, CSS, JavaScript, React y Next.js'),
  ('Datos y ofimática',       'datos-ofimatica',         'Excel, Power BI y bases de datos'),
  ('Redes',                   'redes',                   'Cableado, configuración y administración'),
  ('Ciberseguridad',          'ciberseguridad',          'Protección de la información en empresas'),
  ('Inteligencia artificial', 'inteligencia-artificial', 'Modelos, automatización y herramientas de IA'),
  ('Soporte técnico',         'soporte-tecnico',         'Mantenimiento y reparación de equipos')
on conflict (slug) do nothing;

insert into public.cursos (slug, titulo, descripcion, nivel, modalidad, precio, cupo_maximo, duracion_horas, estado, destacado, categoria_id)
select v.slug, v.titulo, v.descripcion, v.nivel::public.nivel_curso, v.modalidad::public.modalidad_curso,
       v.precio, v.cupo, v.horas, 'PUBLICADO', v.destacado, c.id
from (values
  ('python-desde-cero',       'Python desde cero',                          'Aprende los fundamentos de la programación con Python: variables, estructuras de control, funciones y manejo de archivos, con ejercicios prácticos en cada sesión.', 'BASICO',     'VIRTUAL',        180.00, 30, 40, true,  'programacion'),
  ('desarrollo-web-react',    'Desarrollo web con React y Next.js',         'Construye aplicaciones web modernas con React, Next.js y TailwindCSS, desde los componentes hasta el despliegue en la nube.',                                    'INTERMEDIO', 'SEMIPRESENCIAL', 320.00, 25, 48, true,  'desarrollo-web'),
  ('excel-power-bi',          'Excel empresarial y Power BI',               'Domina tablas dinámicas, funciones avanzadas y tableros en Power BI para analizar la información de tu negocio.',                                                 'INTERMEDIO', 'PRESENCIAL',     150.00, 20, 24, true,  'datos-ofimatica'),
  ('redes-cableado',          'Redes y cableado estructurado',              'Diseña, instala y certifica redes de datos con normas de cableado estructurado y configuración básica de equipos.',                                             'BASICO',     'PRESENCIAL',     220.00, 18, 32, false, 'redes'),
  ('ciberseguridad-pymes',    'Ciberseguridad para pymes',                  'Identifica riesgos, protege la información de tu empresa y aplica buenas prácticas de seguridad en redes, correo y respaldos.',                                  'INTERMEDIO', 'VIRTUAL',        260.00, 30, 30, false, 'ciberseguridad'),
  ('bases-datos-postgresql',  'Bases de datos con PostgreSQL',              'Modela bases de datos relacionales y escribe consultas SQL eficientes con PostgreSQL.',                                                                         'INTERMEDIO', 'VIRTUAL',        200.00, 30, 36, false, 'datos-ofimatica'),
  ('ia-aplicada-negocios',    'Inteligencia artificial aplicada a negocios', 'Aplica modelos de IA para automatizar procesos, analizar datos y crear asistentes inteligentes para tu organización.',                                        'AVANZADO',   'VIRTUAL',        350.00, 25, 40, false, 'inteligencia-artificial'),
  ('soporte-mantenimiento-pc','Soporte técnico y mantenimiento de PC',      'Diagnostica fallas, realiza mantenimiento preventivo y correctivo, e instala sistemas operativos y controladores.',                                               'BASICO',     'PRESENCIAL',     120.00, 15, 20, false, 'soporte-tecnico')
) as v(slug, titulo, descripcion, nivel, modalidad, precio, cupo, horas, destacado, categoria)
join public.categorias c on c.slug = v.categoria
on conflict (slug) do nothing;

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
       case when c.modalidad = 'PRESENCIAL' then 'PRESENCIAL'::public.modalidad_curso else 'VIRTUAL'::public.modalidad_curso end,
       case when c.modalidad = 'PRESENCIAL' then null else 'https://zoom.us/j/0000000000' end
from public.cursos c
cross join generate_series(0, 7) as s(n)
where not exists (select 1 from public.sesiones x where x.curso_id = c.id);

insert into public.cupones (codigo, porcentaje_descuento, fecha_vigencia, usos_maximos) values
  ('BIENVENIDA10', 10, current_date + 90, null),
  ('PEDSAR15',     15, current_date + 30, 50)
on conflict (codigo) do nothing;
