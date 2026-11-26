-- =====================================================================
-- HU-43 · Encuestas de satisfacción
--
-- El administrador crea encuestas con preguntas de escala (1 a 5, ligadas a
-- un aspecto: contenido, instructor, plataforma o general) y preguntas
-- abiertas. Solo una está activa: se envía sola al emitirse el certificado
-- (fin del curso), con un aviso en la campana. Las respuestas son privadas:
-- solo el administrador ve los resultados, y la interfaz los muestra sin
-- nombres. Las preguntas se bloquean tras el primer envío para que los
-- resultados sean comparables en el tiempo (sirven para medir la mejora).
-- =====================================================================

create type public.aspecto_encuesta as enum ('CONTENIDO', 'INSTRUCTOR', 'PLATAFORMA', 'GENERAL');

create table public.encuestas (
  id           bigint generated always as identity primary key,
  titulo       text not null check (char_length(btrim(titulo)) between 3 and 120),
  descripcion  text check (descripcion is null or char_length(descripcion) <= 500),
  activa       boolean not null default false,
  creada_por   uuid references public.perfiles (id) on delete set null,
  creada_en    timestamptz not null default now()
);
-- Una sola encuesta vigente.
create unique index encuestas_una_activa on public.encuestas ((true)) where activa;

create table public.encuesta_preguntas (
  id           bigint generated always as identity primary key,
  encuesta_id  bigint not null references public.encuestas (id) on delete cascade,
  orden        smallint not null check (orden > 0),
  enunciado    text not null check (char_length(btrim(enunciado)) between 3 and 200),
  tipo         text not null check (tipo in ('ESCALA', 'TEXTO')),
  aspecto      public.aspecto_encuesta,
  obligatoria  boolean not null default true,
  unique (encuesta_id, orden),
  -- Las de escala se agrupan por aspecto; las abiertas no tienen aspecto.
  check ((tipo = 'ESCALA') = (aspecto is not null))
);

create table public.encuesta_envios (
  id              bigint generated always as identity primary key,
  encuesta_id     bigint not null references public.encuestas (id) on delete restrict,
  inscripcion_id  uuid not null unique references public.inscripciones (id) on delete cascade,
  estudiante_id   uuid not null references public.perfiles (id) on delete cascade,
  curso_id        uuid not null references public.cursos (id) on delete cascade,
  enviada_en      timestamptz not null default now(),
  respondida_en   timestamptz
);
create index encuesta_envios_estudiante on public.encuesta_envios (estudiante_id);
create index encuesta_envios_encuesta on public.encuesta_envios (encuesta_id);

create table public.encuesta_respuestas (
  envio_id     bigint not null references public.encuesta_envios (id) on delete cascade,
  pregunta_id  bigint not null references public.encuesta_preguntas (id) on delete cascade,
  valor        smallint check (valor between 1 and 5),
  texto        text check (texto is null or char_length(texto) <= 1000),
  primary key (envio_id, pregunta_id),
  check (valor is not null or texto is not null)
);

comment on table public.encuestas is 'HU-43 · Encuestas de satisfacción; solo una activa, que se envía al emitirse el certificado.';
comment on table public.encuesta_envios is 'HU-43 · Encuesta enviada a una inscripción que terminó el curso (una por inscripción).';
comment on table public.encuesta_respuestas is 'HU-43 · Respuestas; solo las lee el administrador.';

-- ---------------------------------------------------------------------
-- Preguntas bloqueadas tras el primer envío
-- ---------------------------------------------------------------------
create function privado.bloquear_preguntas_enviadas()
returns trigger language plpgsql set search_path = '' as $$
begin
  if exists (select 1 from public.encuesta_envios e where e.encuesta_id = coalesce(new.encuesta_id, old.encuesta_id)) then
    raise exception 'La encuesta ya fue enviada: duplícala para cambiar sus preguntas'
      using errcode = 'check_violation';
  end if;
  return coalesce(new, old);
end $$;

create trigger encuesta_preguntas_bloqueo
  before insert or update or delete on public.encuesta_preguntas
  for each row execute function privado.bloquear_preguntas_enviadas();

-- ---------------------------------------------------------------------
-- Envío automático al emitirse el certificado
-- ---------------------------------------------------------------------
create function privado.enviar_encuesta_al_certificar()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_encuesta bigint;
  v_envio    bigint;
  v_est      uuid;
  v_curso    uuid;
  v_titulo   text;
begin
  select e.id into v_encuesta
    from public.encuestas e
   where e.activa and exists (select 1 from public.encuesta_preguntas p where p.encuesta_id = e.id);
  if v_encuesta is null then
    return new;
  end if;

  select i.estudiante_id, i.curso_id, c.titulo into v_est, v_curso, v_titulo
    from public.inscripciones i join public.cursos c on c.id = i.curso_id
   where i.id = new.inscripcion_id;

  insert into public.encuesta_envios (encuesta_id, inscripcion_id, estudiante_id, curso_id)
  values (v_encuesta, new.inscripcion_id, v_est, v_curso)
  on conflict (inscripcion_id) do nothing
  returning id into v_envio;

  if v_envio is not null then
    insert into public.notificaciones (usuario_id, mensaje, enlace, tipo)
    values (v_est, 'Cuéntanos cómo te fue en «' || v_titulo || '»: responde la encuesta de satisfacción (2 minutos)',
            '/estudiante/encuestas/' || v_envio, 'IN_APP');
  end if;
  return new;
end $$;

create trigger certificados_enviar_encuesta
  after insert on public.certificados
  for each row execute function privado.enviar_encuesta_al_certificar();

-- ---------------------------------------------------------------------
-- Responder (el estudiante dueño del envío, una sola vez)
-- ---------------------------------------------------------------------
create function public.responder_encuesta(p_envio bigint, p_respuestas jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_envio public.encuesta_envios%rowtype;
  v_p     record;
  v_crudo jsonb;
  v_valor smallint;
  v_texto text;
begin
  select * into v_envio from public.encuesta_envios where id = p_envio for update;
  if v_envio.id is null or v_envio.estudiante_id is distinct from auth.uid() then
    raise exception 'Encuesta no encontrada' using errcode = 'no_data_found';
  end if;
  if v_envio.respondida_en is not null then
    raise exception 'Ya respondiste esta encuesta' using errcode = 'unique_violation';
  end if;
  if jsonb_typeof(coalesce(p_respuestas, '{}'::jsonb)) <> 'object' then
    raise exception 'Respuestas no válidas' using errcode = 'invalid_parameter_value';
  end if;

  for v_p in
    select * from public.encuesta_preguntas where encuesta_id = v_envio.encuesta_id order by orden
  loop
    v_crudo := p_respuestas -> v_p.id::text;
    v_valor := null;
    v_texto := null;
    if v_p.tipo = 'ESCALA' then
      if v_crudo is not null and jsonb_typeof(v_crudo) = 'number' and (v_crudo #>> '{}') ~ '^[1-5]$' then
        v_valor := (v_crudo #>> '{}')::smallint;
      elsif v_crudo is not null and jsonb_typeof(v_crudo) <> 'null' then
        raise exception 'Califica cada afirmación del 1 al 5' using errcode = 'check_violation';
      end if;
    else
      if v_crudo is not null and jsonb_typeof(v_crudo) = 'string' then
        v_texto := nullif(btrim(v_crudo #>> '{}'), '');
      end if;
      if char_length(coalesce(v_texto, '')) > 1000 then
        raise exception 'Cada comentario admite hasta 1000 caracteres' using errcode = 'check_violation';
      end if;
    end if;

    if v_p.obligatoria and v_valor is null and v_texto is null then
      raise exception 'Responde todas las preguntas obligatorias' using errcode = 'check_violation';
    end if;
    if v_valor is not null or v_texto is not null then
      insert into public.encuesta_respuestas (envio_id, pregunta_id, valor, texto)
      values (v_envio.id, v_p.id, v_valor, v_texto);
    end if;
  end loop;

  update public.encuesta_envios set respondida_en = now() where id = v_envio.id;
end $$;

-- ---------------------------------------------------------------------
-- Seguridad
-- ---------------------------------------------------------------------
alter table public.encuestas enable row level security;
alter table public.encuesta_preguntas enable row level security;
alter table public.encuesta_envios enable row level security;
alter table public.encuesta_respuestas enable row level security;

-- El estudiante ve las encuestas y preguntas que le enviaron; el administrador, todo.
create policy "encuestas_ver" on public.encuestas for select using (
  public.es_admin()
  or exists (select 1 from public.encuesta_envios e where e.encuesta_id = encuestas.id and e.estudiante_id = auth.uid())
);
create policy "encuestas_admin" on public.encuestas for all using (public.es_admin()) with check (public.es_admin());

create policy "encuesta_preguntas_ver" on public.encuesta_preguntas for select using (
  public.es_admin()
  or exists (select 1 from public.encuesta_envios e where e.encuesta_id = encuesta_preguntas.encuesta_id and e.estudiante_id = auth.uid())
);
create policy "encuesta_preguntas_admin" on public.encuesta_preguntas for all using (public.es_admin()) with check (public.es_admin());

-- Los envíos solo los crean el trigger y la función de respuesta.
create policy "encuesta_envios_ver" on public.encuesta_envios for select using (estudiante_id = auth.uid() or public.es_admin());

-- Las respuestas solo las lee el administrador.
create policy "encuesta_respuestas_ver" on public.encuesta_respuestas for select using (public.es_admin());

revoke execute on function privado.bloquear_preguntas_enviadas(), privado.enviar_encuesta_al_certificar() from public, anon, authenticated;
revoke execute on function public.responder_encuesta(bigint, jsonb) from public, anon;
grant execute on function public.responder_encuesta(bigint, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- Encuesta inicial, activa
-- ---------------------------------------------------------------------
with nueva as (
  insert into public.encuestas (titulo, descripcion, activa)
  values ('Encuesta de satisfacción del curso',
          'Nos ayuda a mejorar los cursos y la plataforma. Te tomará unos 2 minutos.', true)
  returning id
)
insert into public.encuesta_preguntas (encuesta_id, orden, enunciado, tipo, aspecto, obligatoria)
select nueva.id, v.orden, v.enunciado, v.tipo, v.aspecto::public.aspecto_encuesta, v.obligatoria
from nueva, (values
  (1, 'Los contenidos y materiales del curso fueron útiles y claros.', 'ESCALA', 'CONTENIDO', true),
  (2, 'El curso cumplió con lo que esperaba aprender.', 'ESCALA', 'CONTENIDO', true),
  (3, 'El instructor explicó con claridad y resolvió mis dudas.', 'ESCALA', 'INSTRUCTOR', true),
  (4, 'El instructor fue puntual y organizado en las sesiones.', 'ESCALA', 'INSTRUCTOR', true),
  (5, 'Fue fácil inscribirme y pagar en la plataforma.', 'ESCALA', 'PLATAFORMA', true),
  (6, 'Encontré con facilidad las sesiones, los materiales y las evaluaciones en mi portal.', 'ESCALA', 'PLATAFORMA', true),
  (7, 'En general, estoy satisfecho con el curso.', 'ESCALA', 'GENERAL', true),
  (8, '¿Qué podríamos mejorar?', 'TEXTO', null, false)
) as v(orden, enunciado, tipo, aspecto, obligatoria);
