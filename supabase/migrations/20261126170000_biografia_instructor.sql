-- HU-34 · Biografía del instructor
--
-- Texto de presentación (hasta 600 caracteres) que el instructor edita en su
-- perfil y el administrador puede cargar al invitarlo. Se publica en el detalle
-- del curso junto con el nombre, la especialidad y la foto.

alter table public.perfiles add column if not exists biografia text;

alter table public.perfiles drop constraint if exists perfiles_biografia_largo;
alter table public.perfiles add constraint perfiles_biografia_largo
  check (biografia is null or char_length(btrim(biografia)) between 1 and 600);

comment on column public.perfiles.biografia is 'HU-34 · Presentación pública del instructor (hasta 600 caracteres).';

-- La función pública suma la biografía; cambiar sus columnas exige recrearla.
drop function if exists public.instructores_publicos(uuid[]);

create function public.instructores_publicos(p_ids uuid[])
returns table (id uuid, nombres text, apellidos text, especialidad text, avatar_url text, biografia text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.nombres, p.apellidos, p.especialidad, p.avatar_url, p.biografia
  from public.perfiles p
  where p.rol = 'instructor' and p.estado and p.id = any (p_ids)
$$;

revoke execute on function public.instructores_publicos(uuid[]) from public;
grant execute on function public.instructores_publicos(uuid[]) to anon, authenticated;

comment on function public.instructores_publicos(uuid[]) is
  'Pública a propósito: nombre, especialidad, foto y biografía del instructor en el catálogo (HU-06 · HU-34).';
