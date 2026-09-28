-- =====================================================================
-- PEDSAR · Esquema inicial
-- Traducción del diagrama de clases a PostgreSQL (Supabase).
-- Paquetes: Gestión de Usuarios · Catálogo y Cursos · Matrícula y Pagos
--           Gestión Académica · Certificación y Soporte
-- =====================================================================

-- ---------------------------------------------------------------------
-- Enumeraciones
-- ---------------------------------------------------------------------
create type public.rol_usuario        as enum ('administrador', 'instructor', 'estudiante');
create type public.estado_curso       as enum ('BORRADOR', 'PUBLICADO', 'DESPUBLICADO');
create type public.modalidad_curso    as enum ('PRESENCIAL', 'VIRTUAL', 'SEMIPRESENCIAL');
create type public.nivel_curso        as enum ('BASICO', 'INTERMEDIO', 'AVANZADO');
create type public.tipo_contenido     as enum ('PDF', 'VIDEO', 'ENLACE');
create type public.estado_inscripcion as enum ('PENDIENTE', 'CONFIRMADA', 'CANCELADA');
create type public.metodo_pago        as enum ('CULQI', 'IZIPAY', 'NIUBIZ', 'YAPE', 'PLIN');
create type public.estado_pago        as enum ('PENDIENTE', 'APROBADO', 'RECHAZADO', 'REEMBOLSADO');
create type public.estado_reembolso   as enum ('SOLICITADO', 'APROBADO', 'RECHAZADO', 'PROCESADO');
create type public.tipo_comprobante   as enum ('BOLETA', 'FACTURA');
create type public.estado_asistencia  as enum ('PRESENTE', 'AUSENTE', 'TARDANZA');
create type public.tipo_notificacion  as enum ('CORREO', 'IN_APP');

-- Utilidad: mantiene actualizado el campo actualizado_en
create or replace function public.tocar_actualizado_en()
returns trigger language plpgsql as $$
begin
  new.actualizado_en = now();
  return new;
end $$;

-- =====================================================================
-- 1. GESTIÓN DE USUARIOS
-- Usuario (abstracta) + Estudiante / Instructor / Administrador se
-- modelan como una sola tabla `perfiles` enlazada a auth.users; el rol
-- define la especialización. La contraseña la gestiona Supabase Auth
-- (bcrypt + JWT, RNF-04), por eso no hay columna contrasenaHash.
-- ---------------------------------------------------------------------
create table public.roles (
  codigo      public.rol_usuario primary key,
  nombre      text not null,
  descripcion text
);

insert into public.roles (codigo, nombre, descripcion) values
  ('administrador', 'Administrador', 'Gestiona usuarios, matrículas, certificados y reportes'),
  ('instructor',    'Instructor',    'Dicta cursos, sube contenidos y registra asistencia y notas'),
  ('estudiante',    'Estudiante',    'Se inscribe en cursos, aprende y descarga certificados');

create table public.perfiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  nombres        text not null default '',
  apellidos      text not null default '',
  correo         text not null unique,
  telefono       text,
  documento      text,                                   -- DNI / CE
  avatar_url     text,
  rol            public.rol_usuario not null default 'estudiante' references public.roles (codigo),
  especialidad   text,                                   -- solo instructores
  estado         boolean not null default true,
  fecha_registro timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create trigger perfiles_actualizado_en before update on public.perfiles
  for each row execute function public.tocar_actualizado_en();

-- Crea el perfil automáticamente al registrarse en Supabase Auth (HU-01)
create or replace function public.crear_perfil_nuevo_usuario()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.perfiles (id, correo, nombres, apellidos)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'nombres', ''),
    coalesce(new.raw_user_meta_data ->> 'apellidos', '')
  );
  return new;
end $$;

create trigger al_crear_usuario after insert on auth.users
  for each row execute function public.crear_perfil_nuevo_usuario();

-- Helpers de autorización usados por las políticas RLS
create or replace function public.rol_actual()
returns public.rol_usuario language sql stable security definer set search_path = '' as $$
  select rol from public.perfiles where id = auth.uid()
$$;

create or replace function public.es_admin()
returns boolean language sql stable as $$
  select coalesce(public.rol_actual() = 'administrador', false)
$$;

-- Evita que un usuario se cambie a sí mismo el rol o el estado
create or replace function public.proteger_campos_perfil()
returns trigger language plpgsql as $$
begin
  if not public.es_admin() and auth.uid() is not null then
    new.rol    = old.rol;
    new.estado = old.estado;
  end if;
  return new;
end $$;

create trigger perfiles_proteger_campos before update on public.perfiles
  for each row execute function public.proteger_campos_perfil();

-- =====================================================================
-- 2. CATÁLOGO Y CURSOS
-- ---------------------------------------------------------------------
create table public.categorias (
  id          bigint generated always as identity primary key,
  nombre      text not null unique,
  slug        text not null unique,
  descripcion text
);

create table public.cursos (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  titulo         text not null,
  descripcion    text,
  imagen_url     text,
  nivel          public.nivel_curso not null default 'BASICO',
  modalidad      public.modalidad_curso not null default 'VIRTUAL',
  precio         numeric(10, 2) not null default 0 check (precio >= 0),
  cupo_maximo    int not null default 30 check (cupo_maximo > 0),
  duracion_horas int not null default 0 check (duracion_horas >= 0),
  estado         public.estado_curso not null default 'BORRADOR',
  destacado      boolean not null default false,
  publicar_en    timestamptz,                            -- HU-57 publicación programada
  categoria_id   bigint references public.categorias (id) on delete set null,
  instructor_id  uuid references public.perfiles (id) on delete set null,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index cursos_categoria_idx  on public.cursos (categoria_id);
create index cursos_instructor_idx on public.cursos (instructor_id);
create index cursos_estado_idx     on public.cursos (estado);

create trigger cursos_actualizado_en before update on public.cursos
  for each row execute function public.tocar_actualizado_en();

create table public.modulos (
  id       bigint generated always as identity primary key,
  curso_id uuid not null references public.cursos (id) on delete cascade,  -- composición
  titulo   text not null,
  orden    int not null default 0
);
create index modulos_curso_idx on public.modulos (curso_id);

create table public.contenidos (
  id          bigint generated always as identity primary key,
  modulo_id   bigint not null references public.modulos (id) on delete cascade,  -- composición
  titulo      text not null,
  tipo        public.tipo_contenido not null,
  url_archivo text not null,                              -- ruta en Storage o URL externa
  orden       int not null default 0
);
create index contenidos_modulo_idx on public.contenidos (modulo_id);

create table public.sesiones (
  id                bigint generated always as identity primary key,
  curso_id          uuid not null references public.cursos (id) on delete cascade,
  fecha             date not null,
  hora_inicio       time not null,
  duracion_minutos  int not null default 90,
  modalidad         public.modalidad_curso not null default 'VIRTUAL',
  enlace_virtual    text
);
create index sesiones_curso_idx on public.sesiones (curso_id);

create or replace function public.es_instructor_de(p_curso uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.cursos where id = p_curso and instructor_id = auth.uid())
$$;

-- =====================================================================
-- 3. MATRÍCULA Y PAGOS
-- ---------------------------------------------------------------------
create table public.inscripciones (
  id                 uuid primary key default gen_random_uuid(),
  codigo             text not null unique
                       default 'MAT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  estudiante_id      uuid not null references public.perfiles (id) on delete cascade,
  curso_id           uuid not null references public.cursos (id) on delete restrict,
  estado             public.estado_inscripcion not null default 'PENDIENTE',
  fecha_inscripcion  timestamptz not null default now(),
  unique (estudiante_id, curso_id)
);
create index inscripciones_curso_idx on public.inscripciones (curso_id);

create or replace function public.esta_inscrito_en(p_curso uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.inscripciones
    where curso_id = p_curso and estudiante_id = auth.uid() and estado = 'CONFIRMADA'
  )
$$;

-- Curso.cupoDisponible()
create or replace function public.cupo_disponible(p_curso uuid)
returns int language sql stable security definer set search_path = '' as $$
  select c.cupo_maximo - count(i.id)::int
  from public.cursos c
  left join public.inscripciones i on i.curso_id = c.id and i.estado <> 'CANCELADA'
  where c.id = p_curso
  group by c.cupo_maximo
$$;

-- Inscripcion.verificarCupo() (HU-17): bloquea la inscripción si no hay cupo
create or replace function public.validar_cupo_inscripcion()
returns trigger language plpgsql as $$
begin
  if coalesce(public.cupo_disponible(new.curso_id), 0) <= 0 then
    raise exception 'El curso no tiene cupos disponibles' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger inscripciones_validar_cupo before insert on public.inscripciones
  for each row execute function public.validar_cupo_inscripcion();

create table public.cupones (
  id                    bigint generated always as identity primary key,
  codigo                text not null unique,
  porcentaje_descuento  numeric(5, 2) not null check (porcentaje_descuento > 0 and porcentaje_descuento <= 100),
  fecha_vigencia        date not null,
  usos_maximos          int,
  activo                boolean not null default true
);

create table public.pagos (
  id                   uuid primary key default gen_random_uuid(),
  inscripcion_id       uuid not null unique references public.inscripciones (id) on delete cascade,
  cupon_id             bigint references public.cupones (id) on delete set null,
  monto                numeric(10, 2) not null check (monto >= 0),
  metodo               public.metodo_pago not null,
  estado               public.estado_pago not null default 'PENDIENTE',
  referencia_pasarela  text,                              -- id de cargo / orden del proveedor
  respuesta_pasarela   jsonb,
  fecha_pago           timestamptz
);

create table public.comprobantes (
  id              bigint generated always as identity primary key,
  pago_id         uuid not null unique references public.pagos (id) on delete cascade,
  tipo            public.tipo_comprobante not null default 'BOLETA',
  serie           text not null,
  numero          text not null,
  fecha_emision   date not null default current_date,
  enviado_sunat   boolean not null default false,
  pdf_url         text,
  unique (serie, numero)
);

create table public.reembolsos (
  id                bigint generated always as identity primary key,
  pago_id           uuid not null references public.pagos (id) on delete cascade,
  motivo            text not null,
  monto             numeric(10, 2) not null check (monto > 0),
  estado            public.estado_reembolso not null default 'SOLICITADO',
  fecha_solicitud   date not null default current_date
);

-- =====================================================================
-- 4. GESTIÓN ACADÉMICA
-- ---------------------------------------------------------------------
create table public.evaluaciones (
  id                   bigint generated always as identity primary key,
  curso_id             uuid not null references public.cursos (id) on delete cascade,
  titulo               text not null,
  puntaje_total        numeric(6, 2) not null default 20,
  intentos_permitidos  int not null default 1 check (intentos_permitidos > 0),
  tiempo_limite_min    int
);

create table public.preguntas (
  id                  bigint generated always as identity primary key,
  evaluacion_id       bigint not null references public.evaluaciones (id) on delete cascade,
  enunciado           text not null,
  opciones            jsonb not null default '[]'::jsonb,  -- List<String>
  respuesta_correcta  text not null,
  puntaje             numeric(6, 2) not null default 1
);

create table public.intentos_evaluacion (
  id                 bigint generated always as identity primary key,
  inscripcion_id     uuid not null references public.inscripciones (id) on delete cascade,
  evaluacion_id      bigint not null references public.evaluaciones (id) on delete cascade,
  numero_intento     int not null,
  respuestas         jsonb not null default '{}'::jsonb,
  puntaje_obtenido   numeric(6, 2),
  fecha              timestamptz not null default now(),
  unique (inscripcion_id, evaluacion_id, numero_intento)
);

create table public.progreso (
  inscripcion_id          uuid primary key references public.inscripciones (id) on delete cascade,
  porcentaje              numeric(5, 2) not null default 0,
  lecciones_completadas   int not null default 0,
  total_lecciones         int not null default 0,
  actualizado_en          timestamptz not null default now()
);

-- Detalle de lecciones marcadas como completadas (HU-28)
create table public.contenidos_completados (
  inscripcion_id  uuid not null references public.inscripciones (id) on delete cascade,
  contenido_id    bigint not null references public.contenidos (id) on delete cascade,
  completado_en   timestamptz not null default now(),
  primary key (inscripcion_id, contenido_id)
);

create table public.asistencias (
  id              bigint generated always as identity primary key,
  inscripcion_id  uuid not null references public.inscripciones (id) on delete cascade,
  sesion_id       bigint not null references public.sesiones (id) on delete cascade,
  estado          public.estado_asistencia not null default 'PRESENTE',
  fecha           date not null default current_date,
  unique (inscripcion_id, sesion_id)
);

-- =====================================================================
-- 5. CERTIFICACIÓN Y SOPORTE
-- ---------------------------------------------------------------------
create table public.certificados (
  id              uuid primary key default gen_random_uuid(),
  inscripcion_id  uuid not null unique references public.inscripciones (id) on delete cascade,
  codigo_unico    text not null unique,
  fecha_emision   date not null default current_date,
  archivo_pdf     text                                    -- ruta en el bucket "certificados"
);

create table public.notificaciones (
  id          bigint generated always as identity primary key,
  usuario_id  uuid not null references public.perfiles (id) on delete cascade,
  mensaje     text not null,
  tipo        public.tipo_notificacion not null default 'IN_APP',
  enlace      text,
  leida       boolean not null default false,
  fecha_envio timestamptz not null default now()
);
create index notificaciones_usuario_idx on public.notificaciones (usuario_id, leida);

create table public.registro_actividad (
  id            bigint generated always as identity primary key,
  usuario_id    uuid references public.perfiles (id) on delete set null,
  accion        text not null,
  detalle       jsonb,
  direccion_ip  inet,
  fecha_hora    timestamptz not null default now()
);
create index registro_actividad_fecha_idx on public.registro_actividad (fecha_hora desc);

-- Verificación pública de certificados (Certificado.verificar(codigo))
create or replace function public.verificar_certificado(p_codigo text)
returns table (codigo_unico text, estudiante text, curso text, duracion_horas int, fecha_emision date)
language sql stable security definer set search_path = '' as $$
  select c.codigo_unico,
         p.nombres || ' ' || p.apellidos,
         cu.titulo,
         cu.duracion_horas,
         c.fecha_emision
  from public.certificados c
  join public.inscripciones i on i.id = c.inscripcion_id
  join public.perfiles p      on p.id = i.estudiante_id
  join public.cursos cu       on cu.id = i.curso_id
  where c.codigo_unico = upper(trim(p_codigo))
$$;

grant execute on function public.verificar_certificado(text) to anon, authenticated;
grant execute on function public.cupo_disponible(uuid)       to anon, authenticated;

-- =====================================================================
-- ROW LEVEL SECURITY
-- Regla general: el administrador puede todo; el resto, solo lo suyo.
-- =====================================================================
alter table public.roles                  enable row level security;
alter table public.perfiles               enable row level security;
alter table public.categorias             enable row level security;
alter table public.cursos                 enable row level security;
alter table public.modulos                enable row level security;
alter table public.contenidos             enable row level security;
alter table public.sesiones               enable row level security;
alter table public.inscripciones          enable row level security;
alter table public.cupones                enable row level security;
alter table public.pagos                  enable row level security;
alter table public.comprobantes           enable row level security;
alter table public.reembolsos             enable row level security;
alter table public.evaluaciones           enable row level security;
alter table public.preguntas              enable row level security;
alter table public.intentos_evaluacion    enable row level security;
alter table public.progreso               enable row level security;
alter table public.contenidos_completados enable row level security;
alter table public.asistencias            enable row level security;
alter table public.certificados           enable row level security;
alter table public.notificaciones         enable row level security;
alter table public.registro_actividad     enable row level security;

-- Roles y categorías: lectura pública
create policy "roles_lectura"        on public.roles      for select using (true);
create policy "categorias_lectura"   on public.categorias for select using (true);
create policy "categorias_admin"     on public.categorias for all    using (public.es_admin()) with check (public.es_admin());

-- Perfiles
create policy "perfiles_ver_propio"      on public.perfiles for select using (id = auth.uid() or public.es_admin());
create policy "perfiles_editar_propio"   on public.perfiles for update using (id = auth.uid() or public.es_admin());
create policy "perfiles_admin"           on public.perfiles for all    using (public.es_admin()) with check (public.es_admin());
-- Los datos públicos de instructores se exponen mediante la vista instructores_publicos

-- Cursos: el catálogo ve los publicados; instructor ve/edita los suyos; admin todo
create policy "cursos_lectura_publica" on public.cursos for select
  using (estado = 'PUBLICADO' or instructor_id = auth.uid() or public.es_admin());
create policy "cursos_instructor_editar" on public.cursos for update
  using (instructor_id = auth.uid()) with check (instructor_id = auth.uid());
create policy "cursos_admin" on public.cursos for all using (public.es_admin()) with check (public.es_admin());

-- Módulos y sesiones: visibles si el curso lo es; gestionados por su instructor
create policy "modulos_lectura" on public.modulos for select
  using (exists (select 1 from public.cursos c where c.id = curso_id));
create policy "modulos_gestion" on public.modulos for all
  using (public.es_instructor_de(curso_id) or public.es_admin())
  with check (public.es_instructor_de(curso_id) or public.es_admin());

create policy "sesiones_lectura" on public.sesiones for select
  using (exists (select 1 from public.cursos c where c.id = curso_id));
create policy "sesiones_gestion" on public.sesiones for all
  using (public.es_instructor_de(curso_id) or public.es_admin())
  with check (public.es_instructor_de(curso_id) or public.es_admin());

-- Contenidos: solo estudiantes inscritos, su instructor o admin
create policy "contenidos_lectura" on public.contenidos for select using (
  exists (
    select 1 from public.modulos m
    where m.id = modulo_id
      and (public.esta_inscrito_en(m.curso_id) or public.es_instructor_de(m.curso_id) or public.es_admin())
  )
);
create policy "contenidos_gestion" on public.contenidos for all using (
  exists (select 1 from public.modulos m where m.id = modulo_id
          and (public.es_instructor_de(m.curso_id) or public.es_admin()))
) with check (
  exists (select 1 from public.modulos m where m.id = modulo_id
          and (public.es_instructor_de(m.curso_id) or public.es_admin()))
);

-- Inscripciones
create policy "inscripciones_ver" on public.inscripciones for select
  using (estudiante_id = auth.uid() or public.es_instructor_de(curso_id) or public.es_admin());
create policy "inscripciones_crear" on public.inscripciones for insert
  with check (estudiante_id = auth.uid() and estado = 'PENDIENTE');
create policy "inscripciones_admin" on public.inscripciones for all
  using (public.es_admin()) with check (public.es_admin());

-- Pagos, comprobantes, reembolsos: el estudiante ve los suyos. Los cambios
-- de estado los hace el servidor (webhooks) con la service role key.
create policy "pagos_ver" on public.pagos for select using (
  public.es_admin() or exists (select 1 from public.inscripciones i
                               where i.id = inscripcion_id and i.estudiante_id = auth.uid())
);
create policy "comprobantes_ver" on public.comprobantes for select using (
  public.es_admin() or exists (select 1 from public.pagos p join public.inscripciones i on i.id = p.inscripcion_id
                               where p.id = pago_id and i.estudiante_id = auth.uid())
);
create policy "reembolsos_ver" on public.reembolsos for select using (
  public.es_admin() or exists (select 1 from public.pagos p join public.inscripciones i on i.id = p.inscripcion_id
                               where p.id = pago_id and i.estudiante_id = auth.uid())
);
create policy "reembolsos_solicitar" on public.reembolsos for insert with check (
  exists (select 1 from public.pagos p join public.inscripciones i on i.id = p.inscripcion_id
          where p.id = pago_id and i.estudiante_id = auth.uid())
);
create policy "reembolsos_admin" on public.reembolsos for all using (public.es_admin()) with check (public.es_admin());
create policy "cupones_admin"    on public.cupones    for all using (public.es_admin()) with check (public.es_admin());
-- Los cupones se validan en el servidor; no se exponen al público.

-- Evaluaciones y preguntas
create policy "evaluaciones_lectura" on public.evaluaciones for select
  using (public.esta_inscrito_en(curso_id) or public.es_instructor_de(curso_id) or public.es_admin());
create policy "evaluaciones_gestion" on public.evaluaciones for all
  using (public.es_instructor_de(curso_id) or public.es_admin())
  with check (public.es_instructor_de(curso_id) or public.es_admin());

-- Las preguntas (con la respuesta correcta) solo las ve el instructor/admin;
-- el estudiante las recibe desde el servidor sin la respuesta.
create policy "preguntas_gestion" on public.preguntas for all using (
  exists (select 1 from public.evaluaciones e where e.id = evaluacion_id
          and (public.es_instructor_de(e.curso_id) or public.es_admin()))
) with check (
  exists (select 1 from public.evaluaciones e where e.id = evaluacion_id
          and (public.es_instructor_de(e.curso_id) or public.es_admin()))
);

-- Datos académicos por inscripción: estudiante dueño, instructor del curso, admin
create or replace function public.puede_ver_inscripcion(p_inscripcion uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.inscripciones i
    left join public.cursos c on c.id = i.curso_id
    where i.id = p_inscripcion
      and (i.estudiante_id = auth.uid() or c.instructor_id = auth.uid()
           or exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol = 'administrador'))
  )
$$;

create policy "intentos_ver"      on public.intentos_evaluacion    for select using (public.puede_ver_inscripcion(inscripcion_id));
create policy "progreso_ver"      on public.progreso               for select using (public.puede_ver_inscripcion(inscripcion_id));
create policy "completados_ver"   on public.contenidos_completados for select using (public.puede_ver_inscripcion(inscripcion_id));
create policy "completados_marcar" on public.contenidos_completados for insert with check (
  exists (select 1 from public.inscripciones i where i.id = inscripcion_id and i.estudiante_id = auth.uid())
);
create policy "asistencias_ver"   on public.asistencias for select using (public.puede_ver_inscripcion(inscripcion_id));
create policy "asistencias_registrar" on public.asistencias for all using (
  exists (select 1 from public.sesiones s where s.id = sesion_id
          and (public.es_instructor_de(s.curso_id) or public.es_admin()))
) with check (
  exists (select 1 from public.sesiones s where s.id = sesion_id
          and (public.es_instructor_de(s.curso_id) or public.es_admin()))
);

-- Certificados
create policy "certificados_ver"   on public.certificados for select using (public.puede_ver_inscripcion(inscripcion_id));
create policy "certificados_admin" on public.certificados for all using (public.es_admin()) with check (public.es_admin());

-- Notificaciones
create policy "notificaciones_propias" on public.notificaciones for select using (usuario_id = auth.uid());
create policy "notificaciones_marcar"  on public.notificaciones for update using (usuario_id = auth.uid());

-- Auditoría: solo admin lee; se escribe desde el servidor
create policy "actividad_admin" on public.registro_actividad for select using (public.es_admin());

-- Vista pública de instructores (sin correo ni datos personales)
create view public.instructores_publicos with (security_invoker = false) as
  select id, nombres, apellidos, especialidad, avatar_url
  from public.perfiles where rol = 'instructor' and estado;
grant select on public.instructores_publicos to anon, authenticated;

-- =====================================================================
-- STORAGE
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public) values
  ('cursos',       'cursos',       true),   -- portadas del catálogo
  ('contenidos',   'contenidos',   false),  -- PDF y videos de los módulos
  ('certificados', 'certificados', false),  -- PDF generados
  ('avatares',     'avatares',     true)
on conflict (id) do nothing;

create policy "storage_lectura_publica" on storage.objects for select
  using (bucket_id in ('cursos', 'avatares'));
create policy "storage_avatar_propio" on storage.objects for all
  using (bucket_id = 'avatares' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatares' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "storage_staff_escribe" on storage.objects for insert
  with check (bucket_id in ('cursos', 'contenidos') and public.rol_actual() in ('administrador', 'instructor'));
-- Los archivos privados (contenidos, certificados) se sirven con URLs firmadas desde el servidor.
