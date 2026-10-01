-- =====================================================================
-- PEDSAR · Endurecimiento de funciones (avisos del Security Advisor)
-- RNF-04 Seguridad y protección de datos
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Las funciones auxiliares de RLS y el trigger de registro salen del
--    esquema que expone la API (lint 0028/0029). Las políticas RLS y el
--    trigger las enlazan por OID, así que siguen funcionando; lo único
--    que cambia es que ya no se pueden invocar por /rest/v1/rpc.
-- ---------------------------------------------------------------------
create schema if not exists privado;
-- es_admin() es SECURITY INVOKER y resuelve privado.rol_actual() con el
-- rol de quien consulta, por eso anon y authenticated necesitan USAGE.
grant usage on schema privado to anon, authenticated;

alter function public.rol_actual()                 set schema privado;
alter function public.es_instructor_de(uuid)       set schema privado;
alter function public.esta_inscrito_en(uuid)       set schema privado;
alter function public.puede_ver_inscripcion(uuid)  set schema privado;
alter function public.crear_perfil_nuevo_usuario() set schema privado;

-- Única función cuyo cuerpo llama por nombre a una función movida.
create or replace function public.es_admin()
returns boolean language sql stable set search_path = '' as $$
  select coalesce(privado.rol_actual() = 'administrador', false)
$$;

-- ---------------------------------------------------------------------
-- 2. search_path fijo en las funciones que no lo tenían (lint 0011).
--    Sus cuerpos ya usan nombres calificados (public.*, auth.*).
-- ---------------------------------------------------------------------
alter function public.tocar_actualizado_en()     set search_path = '';
alter function public.proteger_campos_perfil()   set search_path = '';
alter function public.validar_cupo_inscripcion() set search_path = '';

-- ---------------------------------------------------------------------
-- 3. La vista instructores_publicos era SECURITY DEFINER (lint 0010):
--    se reemplaza por una función que expone exactamente las mismas
--    columnas públicas, solo para los ids que se piden.
-- ---------------------------------------------------------------------
drop view public.instructores_publicos;

create function public.instructores_publicos(p_ids uuid[])
returns table (id uuid, nombres text, apellidos text, especialidad text, avatar_url text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.nombres, p.apellidos, p.especialidad, p.avatar_url
  from public.perfiles p
  where p.rol = 'instructor' and p.estado and p.id = any (p_ids)
$$;
grant execute on function public.instructores_publicos(uuid[]) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. Funciones públicas a propósito: el Security Advisor las seguirá
--    listando (lint 0028/0029) porque el catálogo y la verificación de
--    certificados funcionan sin iniciar sesión.
-- ---------------------------------------------------------------------
comment on function public.cupo_disponible(uuid) is
  'Pública a propósito: el catálogo muestra el cupo libre sin iniciar sesión (HU-17).';
comment on function public.verificar_certificado(text) is
  'Pública a propósito: verificación de certificados por código (HU-11).';
comment on function public.instructores_publicos(uuid[]) is
  'Pública a propósito: nombre, especialidad y foto del instructor en el catálogo (HU-06).';
