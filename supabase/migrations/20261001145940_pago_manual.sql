-- =====================================================================
-- PEDSAR · Pago manual por Yape / Plin
-- Casos de uso «Registrar pago manual» (estudiante) y «Validar
-- comprobantes» (administrador). Es la contingencia de la Tabla 12 del
-- proyecto mientras se completa la afiliación a la pasarela de pagos.
-- =====================================================================

alter table public.pagos
  add column numero_operacion text,
  add column voucher_ruta     text,
  add column reportado_en     timestamptz,
  add column observacion      text;

comment on column public.pagos.numero_operacion is 'N.º de operación de Yape / Plin que informa el estudiante.';
comment on column public.pagos.voucher_ruta     is 'Captura del pago en el bucket privado vouchers ({estudiante}/{archivo}).';
comment on column public.pagos.reportado_en     is 'Momento en que el estudiante registró el pago; null si aún no lo reporta.';
comment on column public.pagos.observacion      is 'Motivo por el que el administrador devolvió el pago para corregirlo.';

-- Un mismo N.º de operación no puede respaldar dos pagos.
create unique index pagos_operacion_unica on public.pagos (metodo, numero_operacion)
  where numero_operacion is not null;

-- ---------------------------------------------------------------------
-- STORAGE · capturas de pago (privadas, máx. 5 MB, imagen o PDF)
-- El estudiante solo sube a su propia carpeta; el administrador las ve
-- con URLs firmadas que genera el servidor.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('vouchers', 'vouchers', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

create policy "vouchers_subir_propio" on storage.objects for insert to authenticated
  with check (bucket_id = 'vouchers' and (storage.foldername(name))[1] = (select auth.uid())::text);
