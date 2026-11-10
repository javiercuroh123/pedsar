/**
 * Plazo para registrar el pago de una inscripción pendiente. Lo aplica la base de
 * datos (trigger validar_cupo_inscripcion y pg_cron); si se cambia, actualizar también
 * la migración vencimiento_reservas.
 */
export const PLAZO_PAGO_HORAS = 48;

/** Una reserva PENDIENTE cuyo plazo pasó ya no ocupa cupo, aunque pg_cron aún no la haya cancelado. */
export const reservaVencida = (i: { estado: string; vence_en: string | null }) =>
  i.estado === "PENDIENTE" && i.vence_en !== null && new Date(i.vence_en) <= new Date();

/** Días mínimos de anticipación antes del inicio del curso para solicitar reembolso (HU-50). */
export const DIAS_ANTICIPACION_REEMBOLSO = 7;

/**
 * Comprueba si un curso admite solicitud de reembolso según la fecha de su primera
 * sesión (`AAAA-MM-DD`) frente a la fecha actual en Perú (`AAAA-MM-DD`). Si el curso
 * aún no tiene sesiones programadas (`null`), sí admite solicitud de reembolso.
 */
export function dentroDePlazoReembolso(
  primeraSesionFecha: string | null | undefined,
  hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date()),
): boolean {
  if (!primeraSesionFecha) return true;
  const inicioMs = Date.parse(`${primeraSesionFecha}T00:00:00-05:00`);
  const hoyMs = Date.parse(`${hoy}T00:00:00-05:00`);
  if (Number.isNaN(inicioMs) || Number.isNaN(hoyMs)) return true;
  const dias = Math.floor((inicioMs - hoyMs) / 86_400_000);
  return dias >= DIAS_ANTICIPACION_REEMBOLSO;
}
