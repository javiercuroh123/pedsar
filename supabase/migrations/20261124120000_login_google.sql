-- =====================================================================
-- PEDSAR · HU-45 Login y registro con Google
-- Google no envía `nombres` ni `apellidos`: envía given_name, family_name y
-- full_name (o name). Sin este ajuste, los perfiles creados con Google
-- quedarían sin nombre. El resto de la función no cambia (HU-49).
-- =====================================================================
create or replace function privado.crear_perfil_nuevo_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_version text := nullif(trim(coalesce(v_meta ->> 'privacidad_version', '')), '');
  v_aceptada timestamptz;
begin
  begin
    v_aceptada := (v_meta ->> 'privacidad_aceptada_en')::timestamptz;
  exception when others then
    v_aceptada := null;
  end;
  if v_version is not null and v_aceptada is null then
    v_aceptada := now();
  end if;

  insert into public.perfiles (id, nombres, apellidos, correo, rol, privacidad_version, privacidad_aceptada_en)
  values (
    new.id,
    coalesce(
      nullif(trim(v_meta ->> 'nombres'), ''),
      nullif(trim(v_meta ->> 'given_name'), ''),
      nullif(trim(v_meta ->> 'full_name'), ''),
      nullif(trim(v_meta ->> 'name'), ''),
      ''
    ),
    coalesce(
      nullif(trim(v_meta ->> 'apellidos'), ''),
      nullif(trim(v_meta ->> 'family_name'), ''),
      ''
    ),
    new.email,
    'estudiante',
    v_version,
    v_aceptada
  );
  return new;
end;
$$;
