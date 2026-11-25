-- HU-21 · HU-40 · RF-11 · Recordatorios por correo
--
-- privado.generar_recordatorios_programados() (pg_cron, cada 15 min) solo crea los
-- avisos de la campana. Los correos se envían desde la app con Resend:
-- /api/cron/recordatorios, que esta migración hace llamar cada 15 min con pg_net.
-- (Vercel Cron en el plan Hobby solo corre una vez al día y no alcanza para el
-- aviso de 1 hora antes de una sesión.)
--
-- La URL y la clave se guardan en Supabase Vault, no en esta migración:
--   select vault.create_secret('https://<dominio>/api/cron/recordatorios', 'recordatorios_url');
--   select vault.create_secret('<mismo valor que CRON_SECRET en Vercel>', 'cron_secret');
-- Mientras no existan, la tarea no hace nada (los avisos in-app siguen igual).

create extension if not exists pg_net with schema extensions;

-- Marcas propias para el correo: el aviso in-app ya registrado no debe bloquearlo.
alter table public.recordatorios_enviados
  drop constraint if exists recordatorios_enviados_tipo_evento_check;
alter table public.recordatorios_enviados
  add constraint recordatorios_enviados_tipo_evento_check
  check (tipo_evento in ('SESION_1H', 'EVALUACION_24H', 'SESION_1H_CORREO', 'EVALUACION_24H_CORREO'));

-- Devuelve el id de la petición de pg_net, o null si falta configurar Vault.
create or replace function privado.disparar_recordatorios_correo()
returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_url     text;
  v_secreto text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'recordatorios_url';
  select decrypted_secret into v_secreto from vault.decrypted_secrets where name = 'cron_secret';
  if coalesce(v_url, '') = '' or coalesce(v_secreto, '') = '' then
    return null;
  end if;

  return net.http_get(
    url := v_url,
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secreto),
    timeout_milliseconds := 60000
  );
end $$;

revoke all on function privado.disparar_recordatorios_correo() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('recordatorios-correo')
    where exists (select 1 from cron.job where jobname = 'recordatorios-correo');

    perform cron.schedule(
      'recordatorios-correo',
      '*/15 * * * *',
      'select privado.disparar_recordatorios_correo()'
    );
  end if;
end $$;
