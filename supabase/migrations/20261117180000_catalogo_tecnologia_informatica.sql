-- =====================================================================
-- PEDSAR · Catálogo real de la empresa (PEDSAR.txt) · HU-18
-- «Tecnología e Informática» como categoría principal, ocho subcategorías
-- y los 33 cursos que dicta la empresa, todos a S/ 150.00 y publicados.
-- El instructor, los horarios y el temario se asignan luego desde el panel.
--
-- También retira los datos de demostración del seed: borra los cursos demo
-- sin inscripciones y despublica los que sí tienen (la FK de inscripciones
-- es RESTRICT y su historial de pagos debe conservarse); luego borra las
-- categorías demo que quedan vacías. «Programación» y «Ciberseguridad» se
-- reutilizan como subcategorías.
-- =====================================================================

-- 1. Categoría principal
insert into public.categorias (nombre, slug, descripcion, activa)
values ('Tecnología e Informática', 'tecnologia-informatica',
        'Ofimática, datos, programación, redes, ciberseguridad y nube', true)
on conflict (slug) do update
  set nombre = excluded.nombre, descripcion = excluded.descripcion, padre_id = null, activa = true;

-- 2. Subcategorías
insert into public.categorias (nombre, slug, descripcion, padre_id, activa)
select v.nombre, v.slug, v.descripcion, p.id, true
from (values
  ('Ofimática y Excel',           'ofimatica-excel',      'Word, Excel, PowerPoint y macros'),
  ('Análisis de datos y BI',      'datos-bi',             'Power BI, dashboards y análisis con Python'),
  ('Bases de datos',              'bases-de-datos',       'SQL Server, Oracle y MongoDB'),
  ('Programación',                'programacion',         'Python, Java, C#, C++ y .NET'),
  ('Desarrollo web y móvil',      'desarrollo-web-movil', 'JavaScript, React, PHP, WordPress y apps móviles'),
  ('Redes y servidores',          'redes-servidores',     'Windows Server, Linux, CCNA, DNS y DHCP'),
  ('Ciberseguridad',              'ciberseguridad',       'Seguridad de la información e informática forense'),
  ('Nube y gestión de procesos',  'nube-procesos',        'AWS y BPM')
) as v(nombre, slug, descripcion)
cross join (select id from public.categorias where slug = 'tecnologia-informatica') as p
on conflict (slug) do update
  set nombre = excluded.nombre, descripcion = excluded.descripcion, padre_id = excluded.padre_id, activa = true;

-- 3. Cursos (en el orden de PEDSAR.txt: creado_en decreciente para que el
--    catálogo, que ordena por destacado y fecha, respete ese orden)
insert into public.cursos (slug, titulo, descripcion, requisitos_previos, nivel, modalidad, precio,
                           cupo_maximo, duracion_horas, estado, destacado, categoria_id, creado_en)
select v.slug, v.titulo, v.descripcion, v.requisitos, v.nivel::public.nivel_curso, 'VIRTUAL',
       150.00, 30, 24, 'PUBLICADO', v.destacado, c.id, now() - make_interval(secs => v.orden)
from (values
  (1,  'windows-server-essentials', 'Windows Server Essentials',
       'Instala, configura y administra Windows Server Essentials: usuarios y grupos, carpetas compartidas, copias de seguridad y acceso remoto para pequeñas empresas.',
       'Conocimientos básicos de redes y de Windows.', 'INTERMEDIO', false, 'redes-servidores'),
  (2,  'ciberseguridad', 'Ciberseguridad',
       'Conoce las amenazas más comunes y aplica controles para proteger equipos, redes y datos: contraseñas seguras, cifrado, copias de respaldo y respuesta ante incidentes.',
       null, 'INTERMEDIO', true, 'ciberseguridad'),
  (3,  'informatica-forense', 'Informática Forense',
       'Identifica, preserva y analiza evidencia digital en equipos y dispositivos siguiendo la cadena de custodia, y presenta los hallazgos en un informe pericial.',
       'Conocimientos de sistemas operativos y redes. Se recomienda haber llevado Ciberseguridad.', 'AVANZADO', false, 'ciberseguridad'),
  (4,  'analisis-datos-python-sql-server-power-bi', 'Análisis de Datos con Python, SQL Server y Power BI',
       'Extrae datos con SQL Server, límpialos y analízalos con Python y presenta los resultados en reportes interactivos de Power BI.',
       'Manejo básico de Excel y lógica de programación.', 'INTERMEDIO', false, 'datos-bi'),
  (5,  'power-bi-inteligencia-negocios', 'Power BI – Inteligencia de Negocios',
       'Conecta y transforma datos con Power Query, crea modelos y medidas DAX, y diseña reportes interactivos para la toma de decisiones.',
       'Manejo de Excel a nivel intermedio.', 'INTERMEDIO', true, 'datos-bi'),
  (6,  'excel-basico', 'Excel Básico',
       'Da tus primeros pasos en Excel: ingreso y formato de datos, fórmulas y funciones básicas, ordenar y filtrar, gráficos e impresión de hojas.',
       null, 'BASICO', false, 'ofimatica-excel'),
  (7,  'excel-intermedio', 'Excel Intermedio',
       'Trabaja con funciones lógicas y de búsqueda, tablas, formato condicional, validación de datos y tablas dinámicas.',
       'Haber llevado Excel Básico o conocimientos equivalentes.', 'INTERMEDIO', false, 'ofimatica-excel'),
  (8,  'excel-desde-cero-hasta-macros', 'Excel desde cero hasta Macros',
       'Recorre Excel de principio a fin: desde las fórmulas básicas y las tablas dinámicas hasta la automatización de tareas con macros y VBA.',
       null, 'BASICO', true, 'ofimatica-excel'),
  (9,  'dashboards-excel-power-bi', 'Generación de Dashboards con Excel y Power BI',
       'Diseña tableros de control con indicadores clave (KPI) en Excel y Power BI: segmentadores, gráficos dinámicos y buenas prácticas de visualización.',
       'Manejo de Excel a nivel intermedio.', 'INTERMEDIO', false, 'datos-bi'),
  (10, 'ofimatica-basica', 'Ofimática Básica',
       'Aprende a usar la computadora en el trabajo diario: Windows, Word, Excel y PowerPoint a nivel inicial, correo electrónico e internet.',
       null, 'BASICO', false, 'ofimatica-excel'),
  (11, 'ofimatica-intermedia', 'Ofimática Intermedia',
       'Elabora documentos profesionales en Word, hojas de cálculo con funciones en Excel y presentaciones efectivas en PowerPoint.',
       'Haber llevado Ofimática Básica o conocimientos equivalentes.', 'INTERMEDIO', false, 'ofimatica-excel'),
  (12, 'ofimatica-profesional', 'Ofimática Profesional',
       'Usa Microsoft Office a nivel avanzado: combinación de correspondencia, documentos extensos, análisis de datos en Excel y trabajo colaborativo en la nube.',
       'Haber llevado Ofimática Intermedia o conocimientos equivalentes.', 'AVANZADO', false, 'ofimatica-excel'),
  (13, 'administracion-bd-sql-server', 'Administración de Base de Datos con SQL Server',
       'Instala y administra SQL Server: diseño de bases de datos, consultas T-SQL, seguridad y usuarios, respaldos y restauración.',
       null, 'INTERMEDIO', false, 'bases-de-datos'),
  (14, 'oracle', 'Oracle',
       'Modela y consulta bases de datos Oracle con SQL y PL/SQL: tablas, vistas, procedimientos almacenados y administración básica.',
       null, 'INTERMEDIO', false, 'bases-de-datos'),
  (15, 'mongodb', 'MongoDB',
       'Trabaja con bases de datos NoSQL orientadas a documentos: colecciones, consultas, índices y agregaciones con MongoDB.',
       null, 'INTERMEDIO', false, 'bases-de-datos'),
  (16, 'javascript', 'JavaScript',
       'Programa la interactividad de las páginas web con JavaScript: variables, funciones, manipulación del DOM, eventos y consumo de APIs.',
       null, 'BASICO', false, 'desarrollo-web-movil'),
  (17, 'c-sharp', 'C#',
       'Aprende a programar con C#: tipos de datos, estructuras de control, métodos y programación orientada a objetos con ejercicios prácticos.',
       null, 'BASICO', false, 'programacion'),
  (18, 'c-plus-plus', 'C++',
       'Desarrolla la lógica de programación con C++: estructuras de control, funciones, arreglos, punteros y programación orientada a objetos.',
       null, 'BASICO', false, 'programacion'),
  (19, 'c-sharp-net', 'C#.NET',
       'Construye aplicaciones de escritorio y web con C# y la plataforma .NET, con acceso a bases de datos y buenas prácticas de desarrollo.',
       'Conocimientos de programación en C#.', 'INTERMEDIO', false, 'programacion'),
  (20, 'react-server', 'React Server',
       'Desarrolla aplicaciones web con React y componentes de servidor: renderizado en el servidor, obtención de datos, rutas y despliegue.',
       'Conocimientos de JavaScript.', 'AVANZADO', false, 'desarrollo-web-movil'),
  (21, 'aplicaciones-moviles', 'Aplicaciones Móviles',
       'Diseña y desarrolla aplicaciones para celulares: interfaces, navegación entre pantallas, almacenamiento de datos y publicación en las tiendas.',
       'Lógica de programación.', 'INTERMEDIO', false, 'desarrollo-web-movil'),
  (22, 'desarrollo-java-i', 'Desarrollo Java I',
       'Inicia en la programación con Java: sintaxis, estructuras de control, arreglos, métodos y fundamentos de la programación orientada a objetos.',
       null, 'BASICO', false, 'programacion'),
  (23, 'desarrollo-java-ii', 'Desarrollo Java II',
       'Profundiza en Java: herencia y polimorfismo, colecciones, manejo de excepciones, archivos y conexión a bases de datos con JDBC.',
       'Haber llevado Desarrollo Java I o conocimientos equivalentes.', 'INTERMEDIO', false, 'programacion'),
  (24, 'programacion-python-i', 'Programación Python I',
       'Aprende a programar desde cero con Python: variables, condicionales, bucles, funciones y estructuras de datos, con ejercicios en cada sesión.',
       null, 'BASICO', true, 'programacion'),
  (25, 'programacion-python-ii', 'Programación Python II',
       'Avanza con Python: programación orientada a objetos, módulos, manejo de archivos y excepciones, y librerías para automatizar tareas.',
       'Haber llevado Programación Python I o conocimientos equivalentes.', 'INTERMEDIO', false, 'programacion'),
  (26, 'diseno-web-wordpress', 'Diseño Web con WordPress',
       'Crea y administra sitios web con WordPress sin programar: temas, plugins, páginas, entradas y tiendas en línea con WooCommerce.',
       null, 'BASICO', false, 'desarrollo-web-movil'),
  (27, 'diseno-web-php', 'Diseño Web con PHP',
       'Desarrolla sitios web dinámicos con PHP y MySQL: formularios, sesiones, conexión a bases de datos y publicación en un hosting.',
       'Conocimientos de HTML y CSS.', 'INTERMEDIO', false, 'desarrollo-web-movil'),
  (28, 'diseno-web-visual-studio', 'Diseño Web con Visual Studio',
       'Crea sitios y aplicaciones web con Visual Studio y ASP.NET: páginas, formularios, conexión a datos y publicación.',
       null, 'INTERMEDIO', false, 'desarrollo-web-movil'),
  (29, 'linux', 'Linux',
       'Administra sistemas Linux desde la terminal: comandos, archivos y permisos, usuarios, instalación de paquetes y servicios.',
       null, 'BASICO', false, 'redes-servidores'),
  (30, 'ccna', 'CCNA',
       'Prepárate para la certificación Cisco CCNA: fundamentos de redes, direccionamiento IP, configuración de routers y switches, VLAN y enrutamiento.',
       null, 'INTERMEDIO', false, 'redes-servidores'),
  (31, 'dns-dhcp', 'DNS y DHCP',
       'Configura y administra los servicios DNS y DHCP en servidores Windows y Linux para resolver nombres y asignar direcciones IP automáticamente.',
       'Conocimientos básicos de redes.', 'INTERMEDIO', false, 'redes-servidores'),
  (32, 'aws-amazon-web-services', 'AWS – Amazon Web Services',
       'Despliega y administra infraestructura en la nube de AWS: servidores EC2, almacenamiento S3, redes VPC, seguridad con IAM y control de costos.',
       null, 'INTERMEDIO', false, 'nube-procesos'),
  (33, 'bpm-gestion-procesos-negocio', 'BPM – Gestión de Procesos de Negocio',
       'Identifica, modela con BPMN, analiza y mejora los procesos de negocio de tu organización para hacerlos más eficientes.',
       null, 'INTERMEDIO', false, 'nube-procesos')
) as v(orden, slug, titulo, descripcion, requisitos, nivel, destacado, categoria)
join public.categorias c on c.slug = v.categoria
on conflict (slug) do nothing;

-- 4. Retiro de los datos de demostración del seed
do $$
declare
  v_despublicados int;
  v_borrados      int;
  v_categorias    int;
begin
  drop table if exists pg_temp.demo_cursos;
  create temp table demo_cursos (slug text primary key, categoria text not null) on commit drop;
  insert into demo_cursos values
    ('python-desde-cero',        'programacion'),
    ('desarrollo-web-react',     'desarrollo-web-movil'),
    ('excel-power-bi',           'datos-bi'),
    ('redes-cableado',           'redes-servidores'),
    ('ciberseguridad-pymes',     'ciberseguridad'),
    ('bases-datos-postgresql',   'bases-de-datos'),
    ('ia-aplicada-negocios',     'datos-bi'),
    ('soporte-mantenimiento-pc', 'redes-servidores');

  -- Con inscripciones: se ocultan y pasan a la subcategoría equivalente.
  update public.cursos cu
     set estado = 'DESPUBLICADO', destacado = false, publicar_en = null,
         categoria_id = (select id from public.categorias where slug = d.categoria)
    from demo_cursos d
   where cu.slug = d.slug
     and exists (select 1 from public.inscripciones i where i.curso_id = cu.id);
  get diagnostics v_despublicados = row_count;

  -- Sin inscripciones: se borran (módulos, sesiones, foros y reseñas caen en cascada).
  delete from public.cursos cu
   using demo_cursos d
   where cu.slug = d.slug
     and not exists (select 1 from public.inscripciones i where i.curso_id = cu.id);
  get diagnostics v_borrados = row_count;

  -- Categorías demo que quedaron sin cursos ni subcategorías.
  delete from public.categorias ca
   where ca.slug in ('desarrollo-web', 'datos-ofimatica', 'redes', 'inteligencia-artificial', 'soporte-tecnico')
     and not exists (select 1 from public.cursos cu where cu.categoria_id = ca.id)
     and not exists (select 1 from public.categorias h where h.padre_id = ca.id);
  get diagnostics v_categorias = row_count;

  insert into public.registro_actividad (usuario_id, accion, detalle)
  values (null, 'CARGAR_CATALOGO', jsonb_build_object(
    'categoria', 'tecnologia-informatica',
    'cursos_demo_borrados', v_borrados,
    'cursos_demo_despublicados', v_despublicados,
    'categorias_demo_borradas', v_categorias));
end;
$$;
