-- Autorización efectiva en la BD, incluso para sesiones emitidas antes de una baja.
create function privado.usuario_activo()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and estado)
$$;
revoke all on function privado.usuario_activo() from public;
grant execute on function privado.usuario_activo() to anon, authenticated, service_role;

create or replace function privado.rol_actual()
returns public.rol_usuario language sql stable security definer set search_path = '' as $$
  select rol from public.perfiles where id = auth.uid() and estado
$$;

do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('create policy cuenta_activa on public.%I as restrictive for all to authenticated using ((select privado.usuario_activo())) with check ((select privado.usuario_activo()))', t.tablename);
  end loop;
end $$;
create policy cuenta_activa on storage.objects as restrictive for all to authenticated
  using ((select privado.usuario_activo())) with check ((select privado.usuario_activo()));

-- Horarios públicos sin exponer el enlace de la clase.
drop policy sesiones_lectura on public.sesiones;
create policy sesiones_lectura on public.sesiones for select to authenticated
  using (privado.esta_inscrito_en(curso_id) or privado.es_instructor_de(curso_id) or public.es_admin());

create function privado.horarios_publicos(p_cursos uuid[])
returns table(id bigint, curso_id uuid, fecha date, hora_inicio time, duracion_minutos int, modalidad public.modalidad_curso)
language sql stable security definer set search_path = '' as $$
  select s.id, s.curso_id, s.fecha, s.hora_inicio, s.duracion_minutos, s.modalidad
  from public.sesiones s join public.cursos c on c.id = s.curso_id
  where c.estado = 'PUBLICADO' and c.id = any(p_cursos)
$$;
create function public.horarios_publicos(p_cursos uuid[])
returns table(id bigint, curso_id uuid, fecha date, hora_inicio time, duracion_minutos int, modalidad public.modalidad_curso)
language sql stable security invoker set search_path = '' as $$
  select * from privado.horarios_publicos(p_cursos)
$$;
revoke all on function privado.horarios_publicos(uuid[]), public.horarios_publicos(uuid[]) from public;
grant execute on function privado.horarios_publicos(uuid[]), public.horarios_publicos(uuid[]) to anon, authenticated, service_role;

-- El bloqueo común por curso serializa reservas y reactivaciones. NO KEY UPDATE
-- evita conflictos con los KEY SHARE adquiridos por las claves foráneas.
drop trigger inscripciones_validar_cupo on public.inscripciones;
drop function public.validar_cupo_inscripcion();
create function privado.validar_cupo_inscripcion()
returns trigger language plpgsql security definer set search_path = '' as $$
declare capacidad int; ocupados int;
begin
  if tg_op = 'UPDATE' and (new.curso_id <> old.curso_id or new.estudiante_id <> old.estudiante_id) then
    raise exception 'No se puede transferir una inscripción' using errcode = '23514';
  end if;
  if new.estado = 'CANCELADA' then return new; end if;
  select cupo_maximo into capacidad from public.cursos where id = new.curso_id for no key update;
  if tg_op = 'INSERT' then
    perform privado.vencer_reservas(new.curso_id);
    new.vence_en = case when new.estado = 'PENDIENTE' then now() + interval '48 hours' end;
  end if;
  if new.estado = 'PENDIENTE' and new.vence_en <= now() then return new; end if;
  select count(*) into ocupados from public.inscripciones i
    where i.curso_id = new.curso_id and i.id <> new.id and i.estado <> 'CANCELADA'
      and not (i.estado = 'PENDIENTE' and i.vence_en is not null and i.vence_en <= now());
  if capacidad is null or ocupados >= capacidad then
    raise exception 'El curso no tiene cupos disponibles' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke all on function privado.validar_cupo_inscripcion() from public, anon, authenticated;
create trigger inscripciones_validar_cupo before insert or update on public.inscripciones
  for each row execute function privado.validar_cupo_inscripcion();

-- Una matrícula no puede nacer sin su pago. RPC exclusiva del servidor: vuelve
-- a validar identidad, precio y cupón; cualquier fallo revierte ambos registros.
drop policy inscripciones_crear on public.inscripciones;
create function public.registrar_matricula(p_estudiante uuid, p_curso uuid, p_metodo public.metodo_pago,
  p_cupon text, p_monto numeric, p_facturacion jsonb)
returns table(inscripcion_id uuid, codigo text, vence_en timestamptz, pago_id uuid, monto numeric, cupon_id bigint)
language plpgsql security invoker set search_path = '' as $$
declare c public.cursos; cp public.cupones; i public.inscripciones; p public.pagos; importe numeric; usados int;
begin
  if not exists(select 1 from public.perfiles where id = p_estudiante and estado and rol = 'estudiante') then
    raise exception 'Estudiante no habilitado' using errcode = '42501';
  end if;
  if p_metodo not in ('CULQI', 'YAPE', 'PLIN') then raise exception 'Medio no disponible'; end if;
  select * into c from public.cursos where id = p_curso and estado = 'PUBLICADO' for no key update;
  if not found then raise exception 'Curso no disponible' using errcode = '22023'; end if;
  if nullif(trim(p_cupon), '') is not null then
    select cu.* into cp from public.cupones cu where cu.codigo = upper(trim(p_cupon)) for update;
    if not found or not cp.activo or cp.fecha_vigencia < (now() at time zone 'America/Lima')::date then
      raise exception 'El cupón ya no está disponible. Revisa el importe antes de inscribirte.' using errcode = '22023';
    end if;
    select count(*) into usados from public.pagos pa join public.inscripciones ins on ins.id = pa.inscripcion_id
      where pa.cupon_id = cp.id and (pa.estado = 'APROBADO' or (pa.estado = 'PENDIENTE' and ins.estado = 'PENDIENTE' and (ins.vence_en is null or ins.vence_en > now())));
    if cp.usos_maximos is not null and usados >= cp.usos_maximos then
      raise exception 'El cupón agotó sus usos. Revisa el importe antes de inscribirte.' using errcode = '22023';
    end if;
  end if;
  importe = round(c.precio * (1 - coalesce(cp.porcentaje_descuento, 0) / 100), 2);
  if p_monto is null or importe <> p_monto then
    raise exception 'El precio cambió. Revisa el importe antes de inscribirte.' using errcode = '22023';
  end if;
  insert into public.inscripciones(estudiante_id, curso_id) values(p_estudiante, p_curso) returning * into i;
  insert into public.pagos(inscripcion_id, monto, metodo, cupon_id, datos_facturacion)
    values(i.id, importe, p_metodo, cp.id, p_facturacion) returning * into p;
  return query select i.id, i.codigo, i.vence_en, p.id, importe, cp.id;
end $$;
revoke all on function public.registrar_matricula(uuid,uuid,public.metodo_pago,text,numeric,jsonb) from public, anon, authenticated;
grant execute on function public.registrar_matricula(uuid,uuid,public.metodo_pago,text,numeric,jsonb) to service_role;

-- Integridad del progreso también ante inserciones directas a la API.
drop policy completados_marcar on public.contenidos_completados;
create policy completados_marcar on public.contenidos_completados for insert to authenticated with check (
  exists(select 1 from public.inscripciones i join public.modulos m on m.curso_id = i.curso_id
    join public.contenidos c on c.modulo_id = m.id
    where i.id = inscripcion_id and i.estudiante_id = auth.uid() and i.estado = 'CONFIRMADA' and c.id = contenido_id)
);
create function privado.recalcular_progreso(p_inscripcion uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare curso uuid; total int; hechos int;
begin
  select curso_id into curso from public.inscripciones where id = p_inscripcion for no key update;
  if not found then return; end if;
  select count(c.id), count(cc.contenido_id) into total, hechos
    from public.modulos m join public.contenidos c on c.modulo_id = m.id
    left join public.contenidos_completados cc on cc.contenido_id = c.id and cc.inscripcion_id = p_inscripcion
    where m.curso_id = curso;
  insert into public.progreso(inscripcion_id, porcentaje, lecciones_completadas, total_lecciones, actualizado_en)
    values(p_inscripcion, case when total > 0 then round(hechos * 100.0 / total, 2) else 0 end, hechos, total, now())
    on conflict(inscripcion_id) do update set porcentaje = excluded.porcentaje, lecciones_completadas = excluded.lecciones_completadas,
      total_lecciones = excluded.total_lecciones, actualizado_en = excluded.actualizado_en;
end $$;
create function privado.actualizar_progreso_completado()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform privado.recalcular_progreso(case when tg_op = 'DELETE' then old.inscripcion_id else new.inscripcion_id end);
  return null;
end $$;
revoke all on function privado.recalcular_progreso(uuid), privado.actualizar_progreso_completado() from public, anon, authenticated;
create trigger completados_progreso after insert or delete on public.contenidos_completados
  for each row execute function privado.actualizar_progreso_completado();

-- Elimina asociaciones inválidas anteriores y repara los porcentajes derivados.
delete from public.contenidos_completados cc where not exists (
  select 1 from public.inscripciones i join public.modulos m on m.curso_id = i.curso_id
  join public.contenidos c on c.modulo_id = m.id where i.id = cc.inscripcion_id and c.id = cc.contenido_id
);
do $$ declare i record; begin
  for i in select id from public.inscripciones order by id loop perform privado.recalcular_progreso(i.id); end loop;
end $$;

-- El plazo se fija al iniciar y se conserva al recargar. Solo el servidor puede
-- abrir/cerrar intentos; la calificación y el consumo se hacen bajo el mismo bloqueo.
create table public.evaluaciones_en_curso (
  inscripcion_id uuid references public.inscripciones(id) on delete cascade,
  evaluacion_id bigint references public.evaluaciones(id) on delete cascade,
  numero_intento int not null,
  iniciado_en timestamptz not null default now(),
  vence_en timestamptz,
  primary key(inscripcion_id, evaluacion_id)
);
alter table public.evaluaciones_en_curso enable row level security;
revoke all on public.evaluaciones_en_curso from anon, authenticated;
grant all on public.evaluaciones_en_curso to service_role;

create function public.iniciar_evaluacion(p_estudiante uuid, p_evaluacion bigint)
returns table(numero_intento int, vence_en timestamptz, servidor_en timestamptz)
language plpgsql security invoker set search_path = '' as $$
declare e public.evaluaciones; ins uuid; usados int;
begin
  if not exists(select 1 from public.perfiles where id = p_estudiante and estado and rol = 'estudiante') then
    raise exception 'Estudiante no habilitado' using errcode = '42501';
  end if;
  select * into e from public.evaluaciones where id = p_evaluacion;
  select id into ins from public.inscripciones where curso_id = e.curso_id and estudiante_id = p_estudiante and estado = 'CONFIRMADA' for update;
  if ins is null then raise exception 'No estás inscrito en este curso'; end if;
  if not exists(select 1 from public.preguntas where evaluacion_id = e.id) then raise exception 'La evaluación no tiene preguntas'; end if;
  select count(*) into usados from public.intentos_evaluacion where inscripcion_id = ins and evaluacion_id = e.id;
  if usados >= e.intentos_permitidos then raise exception 'Ya usaste todos tus intentos'; end if;
  insert into public.evaluaciones_en_curso(inscripcion_id, evaluacion_id, numero_intento, vence_en)
    values(ins, e.id, usados + 1, case when e.tiempo_limite_min > 0 then now() + make_interval(mins => e.tiempo_limite_min) end)
    on conflict(inscripcion_id, evaluacion_id) do nothing;
  return query select s.numero_intento, s.vence_en, clock_timestamp() from public.evaluaciones_en_curso s where s.inscripcion_id = ins and s.evaluacion_id = e.id;
end $$;

create function public.entregar_evaluacion(p_estudiante uuid, p_evaluacion bigint, p_intento int, p_respuestas jsonb)
returns table(puntaje numeric, total numeric, correctas int, preguntas int, intentos_restantes int, fuera_de_plazo boolean)
language plpgsql security invoker set search_path = '' as $$
declare e public.evaluaciones; ins uuid; s public.evaluaciones_en_curso; anterior public.intentos_evaluacion; bruto numeric; maximo numeric; aciertos int; cantidad int; nota numeric; tarde boolean;
begin
  if not exists(select 1 from public.perfiles where id = p_estudiante and estado and rol = 'estudiante') then raise exception 'Estudiante no habilitado' using errcode = '42501'; end if;
  select * into e from public.evaluaciones where id = p_evaluacion;
  select id into ins from public.inscripciones where curso_id = e.curso_id and estudiante_id = p_estudiante and estado = 'CONFIRMADA' for update;
  if ins is null then raise exception 'No estás inscrito en este curso'; end if;
  select * into anterior from public.intentos_evaluacion where inscripcion_id = ins and evaluacion_id = e.id and numero_intento = p_intento;
  if found then
    return query select anterior.puntaje_obtenido, e.puntaje_total, (select count(*)::int from public.preguntas q where q.evaluacion_id = e.id and anterior.respuestas ->> q.id::text = q.respuesta_correcta),
      (select count(*)::int from public.preguntas where evaluacion_id = e.id), greatest(e.intentos_permitidos - p_intento, 0), false;
    return;
  end if;
  select * into s from public.evaluaciones_en_curso where inscripcion_id = ins and evaluacion_id = e.id;
  if not found or s.numero_intento <> p_intento then raise exception 'Inicia la evaluación antes de entregar'; end if;
  -- Cinco segundos de tolerancia exclusivamente para transportar el envío automático.
  tarde = s.vence_en is not null and clock_timestamp() > s.vence_en + interval '5 seconds';
  if tarde then p_respuestas = '{}'::jsonb; end if;
  select coalesce(sum(q.puntaje) filter(where p_respuestas ->> q.id::text = q.respuesta_correcta), 0),
    coalesce(sum(q.puntaje), 0), count(*) filter(where p_respuestas ->> q.id::text = q.respuesta_correcta), count(*)
    into bruto, maximo, aciertos, cantidad from public.preguntas q where q.evaluacion_id = e.id;
  nota = case when maximo > 0 then round(bruto / maximo * e.puntaje_total, 2) else 0 end;
  insert into public.intentos_evaluacion(inscripcion_id, evaluacion_id, numero_intento, respuestas, puntaje_obtenido)
    values(ins, e.id, p_intento, p_respuestas, nota);
  delete from public.evaluaciones_en_curso where inscripcion_id = ins and evaluacion_id = e.id;
  return query select nota, e.puntaje_total, aciertos, cantidad, greatest(e.intentos_permitidos - p_intento, 0), tarde;
end $$;
revoke all on function public.iniciar_evaluacion(uuid,bigint), public.entregar_evaluacion(uuid,bigint,int,jsonb) from public, anon, authenticated;
grant execute on function public.iniciar_evaluacion(uuid,bigint), public.entregar_evaluacion(uuid,bigint,int,jsonb) to service_role;

-- Confirmar una devolución actualiza solicitud, pago y matrícula en conjunto.
-- REEMBOLSADO también permite cerrar solicitudes antiguas que el flujo anterior
-- marcaba prematuramente; el administrador debe confirmar la entrega real.
create function public.finalizar_reembolso(p_reembolso bigint, p_actor uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare r public.reembolsos; p public.pagos;
begin
  if not exists(select 1 from public.perfiles where id=p_actor and estado and rol='administrador') then
    raise exception 'Administrador no habilitado' using errcode='42501';
  end if;
  select * into r from public.reembolsos where id=p_reembolso for update;
  if not found then raise exception 'Solicitud inexistente'; end if;
  if r.estado='PROCESADO' then return true; end if;
  if r.estado<>'APROBADO' then raise exception 'El reembolso debe estar aprobado'; end if;
  select * into p from public.pagos where id=r.pago_id for update;
  if not found or p.estado not in ('APROBADO','REEMBOLSADO') then raise exception 'El pago no admite devolución'; end if;
  update public.pagos set estado='REEMBOLSADO' where id=p.id;
  update public.inscripciones set estado='CANCELADA' where id=p.inscripcion_id;
  update public.reembolsos set estado='PROCESADO' where id=r.id;
  return true;
end $$;
revoke all on function public.finalizar_reembolso(bigint,uuid) from public, anon, authenticated;
grant execute on function public.finalizar_reembolso(bigint,uuid) to service_role;
