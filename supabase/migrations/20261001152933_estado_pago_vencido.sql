-- PEDSAR · Estado de pago para las reservas que vencen sin pago registrado.
-- Va en su propia migración porque un valor de enum nuevo no se puede usar
-- en la misma transacción en que se agrega.
alter type public.estado_pago add value if not exists 'VENCIDO';
