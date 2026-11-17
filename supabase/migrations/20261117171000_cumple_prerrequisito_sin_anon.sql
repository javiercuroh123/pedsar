-- =====================================================================
-- PEDSAR · cumple_prerrequisito solo para estudiantes con sesión y servidor
-- Es security definer y recibe el id de cualquier estudiante: a un visitante
-- le revelaría si ese estudiante completó un curso. Postgres concede EXECUTE
-- a PUBLIC por defecto (y Supabase a anon), así que se revoca a ambos.
-- La usan /cursos/[slug]/inscripcion (estudiante autenticado) y la acción de
-- matrícula (service_role).
-- =====================================================================
revoke execute on function public.cumple_prerrequisito(uuid, uuid) from public, anon;
grant execute on function public.cumple_prerrequisito(uuid, uuid) to authenticated, service_role;
