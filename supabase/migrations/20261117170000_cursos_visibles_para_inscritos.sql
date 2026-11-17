-- =====================================================================
-- PEDSAR · Un curso despublicado sigue visible para sus alumnos confirmados
-- La RLS de cursos solo dejaba leer los PUBLICADO (más los propios del
-- instructor y todo para el admin). Al despublicar un curso, sus alumnos
-- recibían la inscripción con curso = null y el panel /estudiante fallaba.
-- Contenidos, sesiones y evaluaciones ya se leen con
-- privado.esta_inscrito_en(); el curso (y por tanto sus módulos, cuya
-- política depende de poder ver el curso) sigue ahora la misma regla.
-- privado.esta_inscrito_en() es security definer: no hay recursión de RLS.
-- =====================================================================
drop policy if exists "cursos_lectura_publica" on public.cursos;
create policy "cursos_lectura_publica" on public.cursos for select
  using (
    estado = 'PUBLICADO'
    or instructor_id = auth.uid()
    or public.es_admin()
    or privado.esta_inscrito_en(id)
  );
