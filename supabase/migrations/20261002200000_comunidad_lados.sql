-- =====================================================================
-- PEDSAR · Comunidad: los lados de una conversación son «el estudiante» y
-- «el instructor del curso», sea quien sea hoy. Si el administrador reasigna
-- el curso, el nuevo instructor no marca como leídos (ni hace suyos) los
-- mensajes pendientes del anterior.
-- =====================================================================

create or replace function public.marcar_leidos(p_conversacion bigint)
returns integer language sql volatile security definer set search_path = '' as $$
  with marcados as (
    update public.mensajes m
       set leido_en = now()
      from public.conversaciones c
     where c.id = p_conversacion
       and m.conversacion_id = c.id
       and m.leido_en is null
       and privado.participa_en(p_conversacion)
       -- El estudiante lee lo del lado del instructor; el instructor, lo del estudiante.
       and case when c.estudiante_id = auth.uid() then m.autor_id <> c.estudiante_id
                else m.autor_id = c.estudiante_id end
    returning 1
  )
  select count(*)::int from marcados
$$;

comment on function public.marcar_leidos(bigint) is
  'Pública a propósito: marca como leídos los mensajes del otro lado de una conversación en la que participa quien llama.';
