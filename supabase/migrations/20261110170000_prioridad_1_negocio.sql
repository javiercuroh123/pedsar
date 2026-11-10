-- =====================================================================
-- PEDSAR · Correcciones de lógica de negocio (Prioridad 1)
-- - HU-49 (Ley N.º 29733): persistencia de versión y fecha de aceptación
--   de la política de privacidad en public.perfiles.
-- - HU-10: recálculo automático de public.progreso al agregar o eliminar
--   contenidos o módulos de un curso y al confirmar una matrícula.
-- - HU-57: publicación automática de cursos programados (publicar_en)
--   mediante tarea periódica en pg_cron.
-- - RNF-02: función RPC por lotes public.cupos_disponibles(uuid[]) para
--   eliminar las consultas N+1 del catálogo público.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. HU-49 · Registro de aceptación de la política de privacidad
-- ---------------------------------------------------------------------
alter table public.perfiles
  add column if not exists privacidad_version text,
  add column if not exists privacidad_aceptada_en timestamptz;

create or replace function privado.crear_perfil_nuevo_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version text := nullif(trim(coalesce(new.raw_user_meta_data ->> 'privacidad_version', '')), '');
  v_aceptada timestamptz;
begin
  begin
    v_aceptada := (new.raw_user_meta_data ->> 'privacidad_aceptada_en')::timestamptz;
  exception when others then
    v_aceptada := null;
  end;
  if v_version is not null and v_aceptada is null then
    v_aceptada := now();
  end if;

  insert into public.perfiles (id, nombres, apellidos, correo, rol, privacidad_version, privacidad_aceptada_en)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nombres', ''),
    coalesce(new.raw_user_meta_data ->> 'apellidos', ''),
    new.email,
    'estudiante',
    v_version,
    v_aceptada
  );
  return new;
end;
$$;

create or replace function privado.impedir_escalamiento_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') and not public.es_admin() then
    new.rol := old.rol;
    new.estado := old.estado;
    new.privacidad_version := coalesce(old.privacidad_version, new.privacidad_version);
    new.privacidad_aceptada_en := coalesce(old.privacidad_aceptada_en, new.privacidad_aceptada_en);
  end if;
  new.actualizado_en := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. HU-10 · Recálculo automático de public.progreso ante cambios del temario
-- ---------------------------------------------------------------------
create or replace function privado.recalcular_progreso_curso(p_curso uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ins uuid;
begin
  if p_curso is null then
    return;
  end if;
  for v_ins in
    select i.id
    from public.inscripciones i
    where i.curso_id = p_curso
      and (i.estado = 'CONFIRMADA' or exists (select 1 from public.progreso p where p.inscripcion_id = i.id))
  loop
    perform privado.recalcular_progreso(v_ins);
  end loop;
end;
$$;

create or replace function privado.al_cambiar_contenido_progreso()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_curso uuid;
begin
  if tg_op in ('INSERT', 'UPDATE') then
    select curso_id into v_curso from public.modulos where id = new.modulo_id;
    perform privado.recalcular_progreso_curso(v_curso);
  end if;
  if tg_op in ('DELETE', 'UPDATE') and (tg_op = 'DELETE' or old.modulo_id is distinct from new.modulo_id) then
    select curso_id into v_curso from public.modulos where id = old.modulo_id;
    perform privado.recalcular_progreso_curso(v_curso);
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_progreso_contenidos on public.contenidos;
create trigger trg_progreso_contenidos
  after insert or update of modulo_id or delete on public.contenidos
  for each row execute function privado.al_cambiar_contenido_progreso();

create or replace function privado.al_cambiar_modulo_progreso()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('DELETE', 'UPDATE') then
    perform privado.recalcular_progreso_curso(old.curso_id);
  end if;
  if tg_op = 'UPDATE' and new.curso_id is distinct from old.curso_id then
    perform privado.recalcular_progreso_curso(new.curso_id);
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_progreso_modulos on public.modulos;
create trigger trg_progreso_modulos
  after delete or update of curso_id on public.modulos
  for each row execute function privado.al_cambiar_modulo_progreso();

create or replace function privado.al_confirmar_inscripcion_progreso()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.estado = 'CONFIRMADA' and (tg_op = 'INSERT' or old.estado is distinct from 'CONFIRMADA') then
    perform privado.recalcular_progreso(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_progreso_inscripcion on public.inscripciones;
create trigger trg_progreso_inscripcion
  after insert or update of estado on public.inscripciones
  for each row execute function privado.al_confirmar_inscripcion_progreso();

-- Sincronizar el progreso de todas las matrículas confirmadas o con registro previo
do $$
declare
  v_id uuid;
begin
  for v_id in
    select i.id
    from public.inscripciones i
    where i.estado = 'CONFIRMADA'
       or exists (select 1 from public.progreso p where p.inscripcion_id = i.id)
  loop
    perform privado.recalcular_progreso(v_id);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. HU-57 · Publicación automática de cursos programados (publicar_en)
-- ---------------------------------------------------------------------
create or replace function privado.publicar_cursos_programados()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_curso record;
  v_total int := 0;
begin
  for v_curso in
    update public.cursos
    set estado = 'PUBLICADO',
        publicar_en = null,
        actualizado_en = now()
    where estado = 'BORRADOR'
      and publicar_en is not null
      and publicar_en <= now()
    returning id, titulo, slug
  loop
    insert into public.registro_actividad (usuario_id, accion, detalle)
    values (
      null,
      'PUBLICAR_CURSO_PROGRAMADO',
      jsonb_build_object('curso_id', v_curso.id, 'titulo', v_curso.titulo, 'slug', v_curso.slug)
    );
    v_total := v_total + 1;
  end loop;
  return v_total;
end;
$$;

revoke all on function privado.publicar_cursos_programados() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'publicar-cursos-programados') then
    perform cron.unschedule('publicar-cursos-programados');
  end if;
  perform cron.schedule(
    'publicar-cursos-programados',
    '*/5 * * * *',
    'select privado.publicar_cursos_programados()'
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 4. RNF-02 · Consulta por lotes de cupos disponibles (evita N+1 en catálogo)
-- ---------------------------------------------------------------------
create or replace function public.cupos_disponibles(p_cursos uuid[])
returns table(curso_id uuid, cupo_disponible int)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id as curso_id, greatest(c.cupo_maximo - count(i.id)::int, 0) as cupo_disponible
  from public.cursos c
  left join public.inscripciones i
    on i.curso_id = c.id
   and (i.estado = 'CONFIRMADA' or (i.estado = 'PENDIENTE' and (i.vence_en is null or i.vence_en > now())))
  where c.id = any(p_cursos)
  group by c.id, c.cupo_maximo;
$$;

grant execute on function public.cupos_disponibles(uuid[]) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 5. RNF-04 · Control de sesiones concurrentes (máximo 2 por usuario)
-- ---------------------------------------------------------------------
create or replace function privado.limitar_sesiones_usuario(p_usuario uuid, p_max int default 2)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eliminadas int := 0;
begin
  if p_usuario is null or p_max < 1 then
    return 0;
  end if;
  begin
    with recientes as (
      select id
      from auth.sessions
      where user_id = p_usuario
      order by coalesce(updated_at, created_at) desc, id desc
      offset p_max
    ),
    borradas as (
      delete from auth.sessions s
      using recientes r
      where s.id = r.id
      returning s.id
    )
    select count(*)::int into v_eliminadas from borradas;
  exception when insufficient_privilege or undefined_table then
    v_eliminadas := 0;
  end;
  return v_eliminadas;
end;
$$;

revoke all on function privado.limitar_sesiones_usuario(uuid, int) from public, anon, authenticated;

create or replace function privado.al_iniciar_sesion_actividad()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.accion = 'INICIO_SESION' and new.usuario_id is not null then
    perform privado.limitar_sesiones_usuario(new.usuario_id, 2);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_limitar_sesiones_inicio on public.registro_actividad;
create trigger trg_limitar_sesiones_inicio
  after insert on public.registro_actividad
  for each row
  when (new.accion = 'INICIO_SESION')
  execute function privado.al_iniciar_sesion_actividad();

-- ---------------------------------------------------------------------
-- 6. HU-22 · HU-23 · Foro de discusión por curso y comentarios por lección
-- ---------------------------------------------------------------------
create or replace function privado.participa_en_curso(p_curso uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select privado.usuario_activo() and (
    public.es_admin()
    or privado.es_instructor_de(p_curso)
    or privado.esta_inscrito_en(p_curso)
  );
$$;

revoke all on function privado.participa_en_curso(uuid) from public;
grant execute on function privado.participa_en_curso(uuid) to authenticated, service_role;

create table if not exists public.foro_temas (
  id bigint generated always as identity primary key,
  curso_id uuid not null references public.cursos(id) on delete cascade,
  contenido_id bigint references public.contenidos(id) on delete cascade,
  autor_id uuid not null references public.perfiles(id) on delete cascade,
  titulo text not null check (char_length(trim(titulo)) between 3 and 200),
  cuerpo text not null check (char_length(trim(cuerpo)) between 3 and 3000),
  resuelto boolean not null default false,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index if not exists idx_foro_temas_curso on public.foro_temas(curso_id, creado_en desc);
create index if not exists idx_foro_temas_contenido on public.foro_temas(contenido_id, creado_en desc);

create table if not exists public.foro_respuestas (
  id bigint generated always as identity primary key,
  tema_id bigint not null references public.foro_temas(id) on delete cascade,
  autor_id uuid not null references public.perfiles(id) on delete cascade,
  texto text not null check (char_length(trim(texto)) between 1 and 2000),
  creado_en timestamptz not null default now()
);

create index if not exists idx_foro_respuestas_tema on public.foro_respuestas(tema_id, creado_en asc);

alter table public.foro_temas enable row level security;
alter table public.foro_respuestas enable row level security;

drop policy if exists "foro_temas_select_participantes" on public.foro_temas;
create policy "foro_temas_select_participantes"
  on public.foro_temas for select
  to authenticated
  using (privado.participa_en_curso(curso_id));

drop policy if exists "foro_temas_insert_participantes" on public.foro_temas;
create policy "foro_temas_insert_participantes"
  on public.foro_temas for insert
  to authenticated
  with check (
    autor_id = (select auth.uid())
    and privado.participa_en_curso(curso_id)
    and (
      contenido_id is null
      or exists (
        select 1
        from public.contenidos c
        join public.modulos m on m.id = c.modulo_id
        where c.id = contenido_id and m.curso_id = curso_id
      )
    )
  );

drop policy if exists "foro_temas_update_autor_o_docente" on public.foro_temas;
create policy "foro_temas_update_autor_o_docente"
  on public.foro_temas for update
  to authenticated
  using (
    privado.usuario_activo()
    and (autor_id = (select auth.uid()) or privado.es_instructor_de(curso_id) or public.es_admin())
  )
  with check (
    privado.usuario_activo()
    and (autor_id = (select auth.uid()) or privado.es_instructor_de(curso_id) or public.es_admin())
  );

drop policy if exists "foro_temas_delete_autor_o_docente" on public.foro_temas;
create policy "foro_temas_delete_autor_o_docente"
  on public.foro_temas for delete
  to authenticated
  using (
    privado.usuario_activo()
    and (autor_id = (select auth.uid()) or privado.es_instructor_de(curso_id) or public.es_admin())
  );

drop policy if exists "foro_respuestas_select_participantes" on public.foro_respuestas;
create policy "foro_respuestas_select_participantes"
  on public.foro_respuestas for select
  to authenticated
  using (
    exists (
      select 1 from public.foro_temas t
      where t.id = tema_id and privado.participa_en_curso(t.curso_id)
    )
  );

drop policy if exists "foro_respuestas_insert_participantes" on public.foro_respuestas;
create policy "foro_respuestas_insert_participantes"
  on public.foro_respuestas for insert
  to authenticated
  with check (
    autor_id = (select auth.uid())
    and exists (
      select 1 from public.foro_temas t
      where t.id = tema_id and privado.participa_en_curso(t.curso_id)
    )
  );

drop policy if exists "foro_respuestas_delete_autor_o_docente" on public.foro_respuestas;
create policy "foro_respuestas_delete_autor_o_docente"
  on public.foro_respuestas for delete
  to authenticated
  using (
    privado.usuario_activo()
    and (
      autor_id = (select auth.uid())
      or exists (
        select 1 from public.foro_temas t
        where t.id = tema_id and (privado.es_instructor_de(t.curso_id) or public.es_admin())
      )
    )
  );
