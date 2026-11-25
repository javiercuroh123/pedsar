-- =====================================================================
-- PEDSAR · HU-21 · HU-40 · Recordatorios por correo
-- pg_cron llama cada 15 min a /api/cron/recordatorios con pg_net. La URL
-- y la clave salen de Vault; sin ellas la tarea no hace nada. El correo
-- lleva una marca propia, independiente del aviso in-app.
-- =====================================================================
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

select has_extension('pg_net', 'pg_net está instalado para llamar a la app');

select is(
  (select count(*)::int from cron.job
   where jobname = 'recordatorios-correo' and schedule = '*/15 * * * *'
     and command = 'select privado.disparar_recordatorios_correo()'),
  1, 'La tarea recordatorios-correo corre cada 15 minutos'
);

select ok(
  not has_function_privilege('authenticated', 'privado.disparar_recordatorios_correo()', 'execute')
  and not has_function_privilege('anon', 'privado.disparar_recordatorios_correo()', 'execute'),
  'Ni anon ni authenticated pueden disparar los recordatorios'
);

insert into auth.users (id, email, raw_user_meta_data) values
  ('a1000000-0000-4000-8000-000000000001', 'alumna10@pedsar.test', '{"nombres":"Ana","apellidos":"Quispe"}');

select lives_ok($$
  insert into public.recordatorios_enviados (usuario_id, tipo_evento, referencia_id) values
    ('a1000000-0000-4000-8000-000000000001', 'SESION_1H', 99101),
    ('a1000000-0000-4000-8000-000000000001', 'SESION_1H_CORREO', 99101),
    ('a1000000-0000-4000-8000-000000000001', 'EVALUACION_24H', 99102),
    ('a1000000-0000-4000-8000-000000000001', 'EVALUACION_24H_CORREO', 99102)
$$, 'El aviso in-app y el correo del mismo evento tienen marcas separadas');

select throws_ok($$
  insert into public.recordatorios_enviados (usuario_id, tipo_evento, referencia_id) values
    ('a1000000-0000-4000-8000-000000000001', 'SESION_1H_CORREO', 99101)
$$, '23505', null, 'El correo de un mismo evento no se registra dos veces');

select throws_ok($$
  insert into public.recordatorios_enviados (usuario_id, tipo_evento, referencia_id) values
    ('a1000000-0000-4000-8000-000000000001', 'SMS', 99101)
$$, '23514', null, 'Solo se aceptan los tipos de recordatorio conocidos');

-- Sin la URL ni la clave en Vault no se llama a la app.
delete from vault.secrets where name in ('recordatorios_url', 'cron_secret');
select is(privado.disparar_recordatorios_correo(), null::bigint, 'Sin configurar Vault la tarea no hace nada');

select vault.create_secret('http://127.0.0.1:9/api/cron/recordatorios', 'recordatorios_url');
select vault.create_secret('secreto-de-prueba', 'cron_secret');
select isnt(privado.disparar_recordatorios_correo(), null::bigint, 'Con Vault configurado encola la llamada a la app');

select * from finish();
rollback;
