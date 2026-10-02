-- =====================================================================
-- PEDSAR · Pruebas del pago en línea y del comprobante interno
-- HU-12 (comprobante en PDF), HU-30 (comprobantes del estudiante), RF-09
-- =====================================================================
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

create schema pruebas;
create function pruebas.como(p_usuario uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_usuario, 'role', 'authenticated')::text, true);
end $$;
grant usage on schema pruebas to authenticated;
grant execute on all functions in schema pruebas to authenticated;

insert into auth.users (id, email, raw_user_meta_data) values
  ('a0000000-0000-4000-8000-000000000001', 'ana@pedsar.test', '{"nombres":"Ana","apellidos":"Quispe"}'),
  ('a0000000-0000-4000-8000-000000000002', 'beto@pedsar.test', '{"nombres":"Beto"}');
update public.perfiles set documento = '71234567' where id = 'a0000000-0000-4000-8000-000000000001';
insert into public.cursos (id, slug, titulo, precio, cupo_maximo, estado) values
  ('c0000000-0000-4000-8000-000000000001', 'prueba-excel', 'Excel', 180, 30, 'PUBLICADO'),
  ('c0000000-0000-4000-8000-000000000002', 'prueba-redes', 'Redes', 100, 30, 'PUBLICADO');
insert into public.inscripciones (id, estudiante_id, curso_id) values
  ('e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001'),
  ('e0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001'),
  ('e0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002');
-- Ana paga 144 (180 con 20 % de cupón) con tarjeta por Culqi y pide factura; Beto paga por Yape directo.
insert into public.pagos (id, inscripcion_id, monto, metodo, medio, referencia_pasarela, datos_facturacion) values
  ('f0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 144, 'CULQI', 'TARJETA', 'chr_test_1',
   '{"tipo":"FACTURA","ruc":"20123456789","razon_social":"ACME SAC"}');
insert into public.pagos (id, inscripcion_id, monto, metodo) values
  ('f0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000002', 180, 'YAPE');

-- ---------- Emisión al aprobarse el pago ----------
select is((select count(*)::int from public.comprobantes where pago_id = 'f0000000-0000-4000-8000-000000000001'), 0,
  'Un pago pendiente no tiene comprobante');
update public.pagos set estado = 'APROBADO', fecha_pago = now() where id = 'f0000000-0000-4000-8000-000000000001';
select is((select count(*)::int from public.comprobantes where pago_id = 'f0000000-0000-4000-8000-000000000001'), 1,
  'Al aprobarse el pago se emite su comprobante');
select results_eq(
  $$select serie, tipo::text, ruc, razon_social, cliente_nombre, cliente_documento, concepto, subtotal, descuento, total,
           metodo::text, medio, referencia_pasarela
      from public.comprobantes where pago_id = 'f0000000-0000-4000-8000-000000000001'$$,
  $$values ('CP01', 'FACTURA', '20123456789', 'ACME SAC', 'Ana Quispe', '71234567', 'Excel', 180.00::numeric, 36.00::numeric,
            144.00::numeric, 'CULQI', 'TARJETA', 'chr_test_1')$$,
  'El comprobante congela el cliente, el concepto, los importes y el medio de pago');
select matches((select numero from public.comprobantes where pago_id = 'f0000000-0000-4000-8000-000000000001'), '^\d{6}$',
  'El número tiene 6 dígitos');

update public.pagos set estado = 'APROBADO' where id = 'f0000000-0000-4000-8000-000000000001';
select is((select count(*)::int from public.comprobantes where pago_id = 'f0000000-0000-4000-8000-000000000001'), 1,
  'Volver a aprobar el mismo pago no duplica el comprobante');

update public.pagos set estado = 'RECHAZADO' where id = 'f0000000-0000-4000-8000-000000000002';
select is((select count(*)::int from public.comprobantes where pago_id = 'f0000000-0000-4000-8000-000000000002'), 0,
  'Un pago rechazado no genera comprobante');
update public.pagos set estado = 'APROBADO' where id = 'f0000000-0000-4000-8000-000000000002';
select is(
  (select numero::int from public.comprobantes where pago_id = 'f0000000-0000-4000-8000-000000000002')
  - (select numero::int from public.comprobantes where pago_id = 'f0000000-0000-4000-8000-000000000001'), 1,
  'El siguiente comprobante lleva el número correlativo');
select is((select tipo::text from public.comprobantes where pago_id = 'f0000000-0000-4000-8000-000000000002'), 'BOLETA',
  'Sin datos de facturación se registra que el cliente pidió boleta');

insert into public.pagos (id, inscripcion_id, monto, metodo, estado) values
  ('f0000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000003', 100, 'PLIN', 'APROBADO');
select is((select count(*)::int from public.comprobantes where pago_id = 'f0000000-0000-4000-8000-000000000003'), 1,
  'Un pago registrado ya aprobado también tiene comprobante');
delete from public.pagos where id = 'f0000000-0000-4000-8000-000000000003';

-- ---------- Integridad de las referencias de la pasarela ----------
select throws_ok($$insert into public.pagos (inscripcion_id, monto, metodo, referencia_pasarela)
                   values ('e0000000-0000-4000-8000-000000000003', 100, 'CULQI', 'chr_test_1')$$,
  '23505', null, 'Un mismo cargo de Culqi no respalda dos pagos');
update public.pagos set orden_pasarela = 'ord_test_1' where id = 'f0000000-0000-4000-8000-000000000001';
select throws_ok($$insert into public.pagos (inscripcion_id, monto, metodo, orden_pasarela)
                   values ('e0000000-0000-4000-8000-000000000003', 100, 'CULQI', 'ord_test_1')$$,
  '23505', null, 'Una misma orden de Culqi no respalda dos pagos');
select throws_ok($$insert into public.pagos (inscripcion_id, monto, metodo, medio)
                   values ('e0000000-0000-4000-8000-000000000003', 100, 'CULQI', 'EFECTIVO')$$,
  '23514', null, 'Solo se aceptan los medios de la pasarela');

-- ---------- Quién ve cada comprobante (RLS) ----------
select pruebas.como('a0000000-0000-4000-8000-000000000001');
select is((select count(*)::int from public.comprobantes), 1, 'El estudiante ve solo su comprobante');
select pruebas.como('a0000000-0000-4000-8000-000000000002');
select is((select count(*)::int from public.comprobantes where pago_id = 'f0000000-0000-4000-8000-000000000001'), 0,
  'Otro estudiante no ve el comprobante ajeno');
reset role;

select ok(not has_function_privilege('authenticated', 'privado.emitir_comprobante()', 'execute'),
  'La emisión no se puede invocar desde la API');

select * from finish();
rollback;
