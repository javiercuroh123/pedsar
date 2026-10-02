-- =====================================================================
-- PEDSAR · Comunidad: mensajería estudiante–instructor (HU-19) y reseñas
-- de cursos (HU-24). Los chats son privados entre sus dos participantes
-- (el administrador no los lee, Ley N.º 29733); las reseñas se publican
-- con el nombre abreviado y el administrador puede ocultarlas.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Conversaciones: una por curso y estudiante (se conserva si se
--    vuelve a inscribir), con el instructor que dicta el curso.
-- ---------------------------------------------------------------------
create table public.conversaciones (
  id                 bigint generated always as identity primary key,
  curso_id           uuid not null references public.cursos (id) on delete cascade,
  estudiante_id      uuid not null references public.perfiles (id) on delete cascade,
  creada_en          timestamptz not null default now(),
  ultimo_mensaje_en  timestamptz not null default now(),
  unique (curso_id, estudiante_id)
);
create index conversaciones_estudiante on public.conversaciones (estudiante_id);

create table public.mensajes (
  id               bigint generated always as identity primary key,
  conversacion_id  bigint not null references public.conversaciones (id) on delete cascade,
  autor_id         uuid not null references public.perfiles (id) on delete cascade,
  texto            text not null check (char_length(texto) <= 2000 and char_length(btrim(texto, E' \t\r\n')) >= 1),
  enviado_en       timestamptz not null default now(),
  leido_en         timestamptz
);
create index mensajes_conversacion on public.mensajes (conversacion_id, enviado_en);

comment on table public.conversaciones is 'Chat privado entre un estudiante y el instructor de un curso (HU-19).';
comment on column public.mensajes.leido_en is 'Cuándo lo leyó el otro participante; null si sigue sin leer.';

-- Participa: el estudiante dueño o el instructor que dicta el curso.
create function privado.participa_en(p_conversacion bigint)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.conversaciones c
    where c.id = p_conversacion and (c.estudiante_id = auth.uid() or privado.es_instructor_de(c.curso_id))
  )
$$;

-- Puede escribir: el instructor del curso, o el estudiante mientras siga matriculado.
create function privado.puede_escribir_en(p_conversacion bigint)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.conversaciones c
    where c.id = p_conversacion
      and ((c.estudiante_id = auth.uid() and privado.esta_inscrito_en(c.curso_id)) or privado.es_instructor_de(c.curso_id))
  )
$$;

alter table public.conversaciones enable row level security;
alter table public.mensajes enable row level security;

create policy "conversaciones_ver" on public.conversaciones for select
  using (estudiante_id = auth.uid() or privado.es_instructor_de(curso_id));
create policy "conversaciones_crear" on public.conversaciones for insert
  with check (estudiante_id = auth.uid() and privado.esta_inscrito_en(curso_id));

create policy "mensajes_ver" on public.mensajes for select
  using (privado.participa_en(conversacion_id));
create policy "mensajes_enviar" on public.mensajes for insert
  with check (autor_id = auth.uid() and privado.puede_escribir_en(conversacion_id));

-- La conversación guarda la hora del último mensaje (para ordenar la bandeja).
create function privado.tocar_conversacion()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.conversaciones set ultimo_mensaje_en = new.enviado_en where id = new.conversacion_id;
  return null;
end $$;
create trigger mensajes_tocar_conversacion after insert on public.mensajes
  for each row execute function privado.tocar_conversacion();

-- Marca como leídos los mensajes del otro participante; devuelve cuántos.
create function public.marcar_leidos(p_conversacion bigint)
returns integer language sql volatile security definer set search_path = '' as $$
  with marcados as (
    update public.mensajes
       set leido_en = now()
     where conversacion_id = p_conversacion
       and autor_id <> auth.uid()
       and leido_en is null
       and privado.participa_en(p_conversacion)
    returning 1
  )
  select count(*)::int from marcados
$$;

-- ---------------------------------------------------------------------
-- 2. Reseñas: una por inscripción, solo si el curso se completó (100 %
--    de avance o certificado emitido). El administrador las oculta.
-- ---------------------------------------------------------------------
create table public.resenas (
  id              bigint generated always as identity primary key,
  inscripcion_id  uuid not null unique references public.inscripciones (id) on delete cascade,
  curso_id        uuid not null references public.cursos (id) on delete cascade,
  estudiante_id   uuid not null references public.perfiles (id) on delete cascade,
  estrellas       smallint not null check (estrellas between 1 and 5),
  texto           text check (texto is null or char_length(texto) <= 500),
  oculta          boolean not null default false,
  creada_en       timestamptz not null default now(),
  actualizada_en  timestamptz not null default now()
);
create index resenas_curso on public.resenas (curso_id) where not oculta;

comment on table public.resenas is 'Calificación de 1 a 5 estrellas y reseña de quien completó el curso (HU-24).';
comment on column public.resenas.oculta is 'Oculta por el administrador: no se publica ni cuenta en el promedio.';

create function privado.puede_resenar(p_inscripcion uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.inscripciones i
    where i.id = p_inscripcion
      and i.estudiante_id = auth.uid()
      and i.estado = 'CONFIRMADA'
      and (exists (select 1 from public.progreso p where p.inscripcion_id = i.id and p.porcentaje >= 100)
           or exists (select 1 from public.certificados c where c.inscripcion_id = i.id))
  )
$$;

-- El curso y el autor salen de la inscripción, no del navegador; una reseña nueva nunca nace oculta.
create function privado.completar_resena()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  select i.curso_id, i.estudiante_id into new.curso_id, new.estudiante_id
    from public.inscripciones i where i.id = new.inscripcion_id;
  new.oculta = false;
  new.creada_en = now();
  new.actualizada_en = now();
  return new;
end $$;
create trigger resenas_completar before insert on public.resenas
  for each row execute function privado.completar_resena();

-- Solo el administrador cambia «oculta»; nadie cambia de curso, autor o inscripción.
create function privado.proteger_resena()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not public.es_admin() and auth.uid() is not null then
    new.oculta = old.oculta;
  end if;
  new.inscripcion_id = old.inscripcion_id;
  new.curso_id = old.curso_id;
  new.estudiante_id = old.estudiante_id;
  new.actualizada_en = now();
  return new;
end $$;
create trigger resenas_proteger before update on public.resenas
  for each row execute function privado.proteger_resena();

alter table public.resenas enable row level security;
create policy "resenas_ver" on public.resenas for select
  using (estudiante_id = auth.uid() or public.es_admin());
create policy "resenas_crear" on public.resenas for insert
  with check (estudiante_id = auth.uid() and privado.puede_resenar(inscripcion_id));
create policy "resenas_editar_propia" on public.resenas for update
  using (estudiante_id = auth.uid())
  with check (estudiante_id = auth.uid() and privado.puede_resenar(inscripcion_id));
create policy "resenas_moderar" on public.resenas for update
  using (public.es_admin()) with check (public.es_admin());

-- Promedio y cantidad de reseñas visibles por curso (catálogo, detalle y panel).
create function public.calificacion_cursos(p_ids uuid[])
returns table (curso_id uuid, promedio numeric, cantidad integer)
language sql stable security definer set search_path = '' as $$
  select r.curso_id, round(avg(r.estrellas)::numeric, 1), count(*)::int
    from public.resenas r
   where r.curso_id = any (p_ids) and not r.oculta
   group by r.curso_id
$$;

-- Reseñas visibles de un curso con el nombre abreviado del autor («Ana Q.»).
create function public.resenas_publicas(p_curso uuid, p_limite integer default 6)
returns table (estrellas smallint, texto text, autor text, fecha timestamptz)
language sql stable security definer set search_path = '' as $$
  select r.estrellas,
         r.texto,
         trim(split_part(trim(p.nombres), ' ', 1) || ' ' || coalesce(nullif(left(trim(p.apellidos), 1), '') || '.', '')),
         r.actualizada_en
    from public.resenas r
    join public.perfiles p on p.id = r.estudiante_id
   where r.curso_id = p_curso and not r.oculta
   order by r.actualizada_en desc
   limit least(greatest(p_limite, 1), 50)
$$;

-- ---------------------------------------------------------------------
-- 3. Permisos de las funciones
-- ---------------------------------------------------------------------
revoke execute on function privado.participa_en(bigint), privado.puede_escribir_en(bigint), privado.puede_resenar(uuid) from public, anon;
grant execute on function privado.participa_en(bigint), privado.puede_escribir_en(bigint), privado.puede_resenar(uuid) to authenticated;
revoke execute on function privado.tocar_conversacion(), privado.completar_resena(), privado.proteger_resena() from public, anon, authenticated;
revoke execute on function public.marcar_leidos(bigint) from public, anon;
grant execute on function public.marcar_leidos(bigint) to authenticated;
revoke execute on function public.calificacion_cursos(uuid[]), public.resenas_publicas(uuid, integer) from public;
grant execute on function public.calificacion_cursos(uuid[]), public.resenas_publicas(uuid, integer) to anon, authenticated;
