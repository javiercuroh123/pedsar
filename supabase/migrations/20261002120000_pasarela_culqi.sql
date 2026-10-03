-- =====================================================================
-- PEDSAR · Pago en línea con Culqi y comprobante interno de pago
-- HU-12 (pagos en línea y comprobante en PDF), HU-30 (comprobantes del
-- estudiante) y RF-09. El comprobante es un documento interno de PEDSAR:
-- no reemplaza la boleta ni la factura electrónica SUNAT (HU-31).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Datos de la pasarela en el pago. Los pagos en línea usan
--    metodo = 'CULQI' y su medio; YAPE / PLIN quedan para el pago directo.
-- ---------------------------------------------------------------------
alter table public.pagos
  add column medio             text check (medio in ('TARJETA', 'YAPE', 'BILLETERA', 'BANCA_MOVIL', 'AGENTE')),
  add column orden_pasarela    text,
  add column datos_facturacion jsonb not null default '{"tipo":"BOLETA"}'::jsonb;

comment on column public.pagos.medio is
  'Medio con que se pagó por la pasarela (metodo = CULQI); null en los pagos directos por Yape / Plin.';
comment on column public.pagos.orden_pasarela is
  'Orden de Culqi (ord_…) con la que se paga por billetera, banca móvil o agente.';
comment on column public.pagos.datos_facturacion is
  'Comprobante que pidió el cliente: {"tipo":"BOLETA"} o {"tipo":"FACTURA","ruc":"…","razon_social":"…"}.';

-- Un mismo cargo u orden de la pasarela nunca confirma dos pagos.
create unique index pagos_referencia_unica on public.pagos (referencia_pasarela) where referencia_pasarela is not null;
create unique index pagos_orden_unica on public.pagos (orden_pasarela) where orden_pasarela is not null;

-- ---------------------------------------------------------------------
-- 2. Comprobante interno: serie CP01 y número correlativo. Los datos se
--    congelan al emitirlo, como en los certificados.
-- ---------------------------------------------------------------------
create sequence public.comprobante_numero_seq;

alter table public.comprobantes
  add column cliente_nombre      text,
  add column cliente_documento   text,
  add column ruc                 text,
  add column razon_social        text,
  add column concepto            text,
  add column subtotal            numeric(10, 2),
  add column descuento           numeric(10, 2),
  add column total               numeric(10, 2),
  add column metodo              public.metodo_pago,
  add column medio               text,
  add column referencia_pasarela text;

comment on column public.comprobantes.serie is
  'Serie interna de PEDSAR (CP01). No es una serie SUNAT: el comprobante no reemplaza la boleta o factura electrónica.';
comment on column public.comprobantes.tipo is
  'Comprobante SUNAT que pidió el cliente, para emitirlo después (HU-31).';

-- Emite el comprobante de un pago si aún no lo tiene. El número solo se
-- toma de la secuencia cuando de verdad se inserta.
create function privado.insertar_comprobante(p_pago uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.comprobantes (pago_id, tipo, serie, numero, fecha_emision, cliente_nombre, cliente_documento, ruc,
                                   razon_social, concepto, subtotal, descuento, total, metodo, medio, referencia_pasarela)
  select p.id,
         coalesce(nullif(p.datos_facturacion ->> 'tipo', ''), 'BOLETA')::public.tipo_comprobante,
         'CP01',
         lpad(nextval('public.comprobante_numero_seq')::text, 6, '0'),
         coalesce((p.fecha_pago at time zone 'America/Lima')::date, current_date),
         trim(e.nombres || ' ' || e.apellidos),
         e.documento,
         nullif(p.datos_facturacion ->> 'ruc', ''),
         nullif(p.datos_facturacion ->> 'razon_social', ''),
         c.titulo,
         greatest(c.precio, p.monto),
         greatest(c.precio - p.monto, 0),
         p.monto,
         p.metodo,
         p.medio,
         p.referencia_pasarela
    from public.pagos p
    join public.inscripciones i on i.id = p.inscripcion_id
    join public.perfiles e on e.id = i.estudiante_id
    join public.cursos c on c.id = i.curso_id
   where p.id = p_pago
     and not exists (select 1 from public.comprobantes x where x.pago_id = p.id)
  on conflict (pago_id) do nothing;
end $$;

-- Pago.generarComprobante(): sea cual sea la vía de aprobación (cargo,
-- webhook o validación manual del administrador).
create function privado.emitir_comprobante()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.estado = 'APROBADO' and (tg_op = 'INSERT' or old.estado is distinct from 'APROBADO') then
    perform privado.insertar_comprobante(new.id);
  end if;
  return null;
end $$;

create trigger pagos_emitir_comprobante after insert or update of estado on public.pagos
  for each row execute function privado.emitir_comprobante();

revoke execute on function privado.insertar_comprobante(uuid) from public, anon, authenticated;
revoke execute on function privado.emitir_comprobante() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. Comprobantes de los pagos que ya estaban aprobados, en orden de pago.
-- ---------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in select id from public.pagos where estado = 'APROBADO' order by fecha_pago nulls last, id loop
    perform privado.insertar_comprobante(r.id);
  end loop;
end $$;
