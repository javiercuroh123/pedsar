-- HU-46 · Testimonios en la página de inicio
--
-- Salen de las reseñas reales de quienes culminaron un curso (HU-24), no de
-- textos escritos aparte: solo reseñas visibles (el administrador puede
-- ocultarlas), de 4 o 5 estrellas, con al menos 20 caracteres de texto y de
-- cursos publicados. Una por estudiante, para que no se repita la misma persona.
-- El autor se muestra abreviado («Ana Q.»), igual que en el detalle del curso.

create or replace function public.testimonios_publicos(p_limite integer default 3)
returns table (estrellas smallint, texto text, autor text, curso text, curso_slug text, fecha timestamptz)
language sql stable security definer set search_path = '' as $$
  select t.estrellas, t.texto, t.autor, t.curso, t.curso_slug, t.fecha
  from (
    select distinct on (r.estudiante_id)
           r.estrellas,
           btrim(r.texto) as texto,
           trim(split_part(trim(p.nombres), ' ', 1) || ' ' || coalesce(nullif(left(trim(p.apellidos), 1), '') || '.', '')) as autor,
           c.titulo as curso,
           c.slug as curso_slug,
           r.actualizada_en as fecha
      from public.resenas r
      join public.perfiles p on p.id = r.estudiante_id
      join public.cursos c on c.id = r.curso_id and c.estado = 'PUBLICADO'
     where not r.oculta
       and r.estrellas >= 4
       and char_length(btrim(coalesce(r.texto, ''))) >= 20
     order by r.estudiante_id, r.estrellas desc, r.actualizada_en desc
  ) t
  order by t.estrellas desc, t.fecha desc
  limit least(greatest(p_limite, 1), 12)
$$;

revoke execute on function public.testimonios_publicos(integer) from public;
grant execute on function public.testimonios_publicos(integer) to anon, authenticated;
