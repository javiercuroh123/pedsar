/** Nota mínima aprobatoria en escala vigesimal (13/20), aplicada como proporción del puntaje total. */
export const NOTA_MINIMA = 13;
export const PROPORCION_APROBATORIA = NOTA_MINIMA / 20;

/** Asistencia mínima para aprobar y recibir certificado. */
export const ASISTENCIA_MINIMA = 75;

export const aprobado = (puntaje: number, total: number) => total > 0 && puntaje / total >= PROPORCION_APROBATORIA;
