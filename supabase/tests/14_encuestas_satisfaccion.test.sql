-- =====================================================================
-- PEDSAR · HU-43 · Encuestas de satisfacción
-- Envío automático al emitirse el certificado, respuesta única del dueño,
-- preguntas bloqueadas tras el envío y resultados solo para el administrador.
-- =====================================================================
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

create schema pruebas;
create function pruebas.como(p_usuario uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_usuario, 'role', 'authenticated')::text, true);
end $$;
create function pruebas.como_postgres() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;
grant usage on schema pruebas to anon, authenticated;
grant execute on all functions in schema pruebas to anon, authenticated;

-- La encuesta inicial de la migración (si en esta base ya hay otra activa, se usa esa).
create temporary table vigente on commit drop as select id from public.encuestas where activa;
grant select on vigente to authenticated;

select is((select count(*)::int from vigente), 1, 'Hay una encuesta vigente');
select ok((select count(*) from public.encuesta_preguntas p join vigente v on v.id = p.encuesta_id where p.tipo = 'ESCALA') >= 1,
  'La encuesta vigente tiene preguntas de escala');
select throws_ok($$insert into public.encuestas (titulo, activa) values ('Otra activa', true)$$, '23505', null,
  'Solo puede haber una encuesta activa');

insert into auth.users (id, email, raw_user_meta_data) values
  ('a1400000-0000-4000-8000-000000000001', 'ana14@pedsar.test',   '{"nombres":"Ana","apellidos":"Quispe"}'),
  ('a1400000-0000-4000-8000-000000000002', 'beto14@pedsar.test',  '{"nombres":"Beto","apellidos":"Paz"}'),
  ('a1400000-0000-4000-8000-000000000003', 'admin14@pedsar.test', '{"nombres":"Admin","apellidos":"PEDSAR"}');
update public.perfiles set rol = 'administrador' where id = 'a1400000-0000-4000-8000-000000000003';
insert into public.cursos (id, slug, titulo, precio, duracion_horas, estado) values
  ('c1400000-0000-4000-8000-000000000001', 'prueba-encuestas', 'Excel 14', 150, 24, 'PUBLICADO');
insert into public.inscripciones (id, estudiante_id, curso_id) values
  ('e1400000-0000-4000-8000-000000000001', 'a1400000-0000-4000-8000-000000000001', 'c1400000-0000-4000-8000-000000000001'),
  ('e1400000-0000-4000-8000-000000000002', 'a1400000-0000-4000-8000-000000000002', 'c1400000-0000-4000-8000-000000000001');
update public.inscripciones set estado = 'CONFIRMADA', vence_en = null where id::text like 'e1400000%';

-- Ana termina el curso: se emite su certificado.
insert into public.certificados (inscripcion_id, codigo_unico) values ('e1400000-0000-4000-8000-000000000001', 'PED-2026-ENC14AAA');

select is((select count(*)::int from public.encuesta_envios e join vigente v on v.id = e.encuesta_id
           where e.inscripcion_id = 'e1400000-0000-4000-8000-000000000001' and e.respondida_en is null), 1,
  'Al emitirse el certificado se envía la encuesta vigente');
select is((select count(*)::int from public.notificaciones
           where usuario_id = 'a1400000-0000-4000-8000-000000000001' and enlace like '/estudiante/encuestas/%'), 1,
  'El estudiante recibe el aviso en la campana con el enlace a la encuesta');
select throws_ok($$insert into public.encuesta_preguntas (encuesta_id, orden, enunciado, tipo) select id, 99, '¿Algo más?', 'TEXTO' from vigente$$,
  '23514', null, 'Tras el primer envío las preguntas quedan bloqueadas');

create temporary table envio_ana on commit drop as
  select id from public.encuesta_envios where inscripcion_id = 'e1400000-0000-4000-8000-000000000001';
grant select on envio_ana to authenticated;
-- Respuestas completas de Ana: 5 en cada pregunta de escala y un comentario en las abiertas.
create temporary table respuestas_ana on commit drop as
  select jsonb_object_agg(p.id::text, case when p.tipo = 'ESCALA' then to_jsonb(5) else to_jsonb('Más prácticas, por favor'::text) end) as r
  from public.encuesta_preguntas p join vigente v on v.id = p.encuesta_id;
grant select on respuestas_ana to authenticated;

-- Beto (sin certificado) no tiene encuesta ni puede responder la de Ana.
select pruebas.como('a1400000-0000-4000-8000-000000000002');
select is_empty($$select * from public.encuesta_envios$$, 'Un estudiante no ve encuestas ajenas');
select throws_ok($$select public.responder_encuesta((select id from envio_ana), (select r from respuestas_ana))$$,
  'P0002', 'Encuesta no encontrada', 'Nadie responde la encuesta de otro estudiante');

select pruebas.como('a1400000-0000-4000-8000-000000000001');
select is((select count(*)::int from public.encuesta_preguntas), (select count(*)::int from public.encuesta_preguntas p join vigente v on v.id = p.encuesta_id),
  'El estudiante ve las preguntas de la encuesta que le enviaron');
select throws_ok($$select public.responder_encuesta((select id from envio_ana), '{}'::jsonb)$$,
  '23514', 'Responde todas las preguntas obligatorias', 'Sin las preguntas obligatorias no se guarda');
select throws_ok($$select public.responder_encuesta((select id from envio_ana),
    (select r || jsonb_build_object((select min(p.id)::text from public.encuesta_preguntas p where p.tipo = 'ESCALA'), 7) from respuestas_ana))$$,
  '23514', 'Califica cada afirmación del 1 al 5', 'Las calificaciones van del 1 al 5');
select lives_ok($$select public.responder_encuesta((select id from envio_ana), (select r from respuestas_ana))$$,
  'El estudiante responde su encuesta');
select throws_ok($$select public.responder_encuesta((select id from envio_ana), (select r from respuestas_ana))$$,
  '23505', 'Ya respondiste esta encuesta', 'Solo se responde una vez');
select is_empty($$select * from public.encuesta_respuestas$$, 'El estudiante no lee las respuestas guardadas');

select pruebas.como('a1400000-0000-4000-8000-000000000003');
select is((select count(*)::int from public.encuesta_respuestas r join envio_ana e on e.id = r.envio_id),
          (select count(*)::int from public.encuesta_preguntas p join vigente v on v.id = p.encuesta_id),
  'El administrador lee las respuestas para los resultados');

-- Sin encuesta activa, el certificado no envía nada.
select pruebas.como_postgres();
update public.encuestas set activa = false where activa;
insert into public.certificados (inscripcion_id, codigo_unico) values ('e1400000-0000-4000-8000-000000000002', 'PED-2026-ENC14BBB');
select is_empty($$select * from public.encuesta_envios where inscripcion_id = 'e1400000-0000-4000-8000-000000000002'$$,
  'Sin encuesta activa no se envía ninguna');

select * from finish();
rollback;
