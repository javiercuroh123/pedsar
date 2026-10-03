/**
 * Plazo para registrar el pago de una inscripción pendiente. Lo aplica la base de
 * datos (trigger validar_cupo_inscripcion y pg_cron); si se cambia, actualizar también
 * la migración vencimiento_reservas.
 */
export const PLAZO_PAGO_HORAS = 48;

/** Una reserva PENDIENTE cuyo plazo pasó ya no ocupa cupo, aunque pg_cron aún no la haya cancelado. */
export const reservaVencida = (i: { estado: string; vence_en: string | null }) =>
  i.estado === "PENDIENTE" && i.vence_en !== null && new Date(i.vence_en) <= new Date();
