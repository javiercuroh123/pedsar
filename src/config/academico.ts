/** Nota mínima aprobatoria en escala vigesimal (13/20), aplicada como proporción del puntaje total. */
export const NOTA_MINIMA = 13;
export const PROPORCION_APROBATORIA = NOTA_MINIMA / 20;

/** Asistencia mínima para aprobar y recibir certificado. */
export const ASISTENCIA_MINIMA = 75;

export const aprobado = (puntaje: number, total: number) => total > 0 && puntaje / total >= PROPORCION_APROBATORIA;

/**
 * Un certificado es «de aprobación» (y muestra la nota) si el curso tenía evaluaciones y la
 * nota final llegó al mínimo; si no, es «de participación» y la nota no se publica.
 */
export const esCertificadoDeAprobacion = (notaFinal: number | null | undefined) => notaFinal != null && notaFinal >= NOTA_MINIMA;

/**
 * Nota (un decimal) y asistencia (entero) truncadas, no redondeadas: así la cifra que se
 * muestra solo alcanza el mínimo si la real lo alcanza (12,96 se ve «12.9», no «13.0»).
 * El margen corrige errores de coma flotante (14.3 × 10 = 142.99…).
 */
export const formatearNota = (nota: number) => (Math.floor(nota * 10 + 1e-9) / 10).toFixed(1);
export const formatearAsistencia = (porcentaje: number) => String(Math.floor(porcentaje + 1e-9));

/** Fila de la función resultado_academico de la base de datos (una por inscripción). */
export interface ResultadoAcademico {
  inscripcion_id: string;
  evaluaciones: number;
  rendidas: number;
  /** Promedio vigesimal de la mejor nota de cada evaluación (las no rendidas cuentan 0); null sin evaluaciones. */
  nota_final: number | null;
  sesiones: number;
  presentes: number;
  /** % de asistencia; null si aún no hubo sesiones. */
  asistencia: number | null;
  contenidos: number;
  completados: number;
  progreso: number | null;
}

/**
 * Requisitos para emitir el certificado (HU-11): rendir todas las evaluaciones con
 * nota final ≥ NOTA_MINIMA y asistir al ASISTENCIA_MINIMA % de las sesiones dictadas.
 * Lo que el curso no tiene (evaluaciones o sesiones) no se exige, pero debe haber al
 * menos uno de los dos. El avance en contenidos es informativo.
 */
export function evaluarAptitud(r: ResultadoAcademico | undefined): { apto: boolean; motivos: string[] } {
  if (!r) return { apto: false, motivos: ["Sin datos académicos"] };
  const motivos: string[] = [];
  if (r.evaluaciones > 0) {
    if (r.rendidas < r.evaluaciones) motivos.push(`Faltan rendir ${r.evaluaciones - r.rendidas} de ${r.evaluaciones} evaluaciones`);
    else if ((r.nota_final ?? 0) < NOTA_MINIMA) motivos.push(`Nota final ${formatearNota(r.nota_final ?? 0)}/20 (mínimo ${NOTA_MINIMA})`);
  }
  if (r.sesiones > 0 && (r.asistencia ?? 0) < ASISTENCIA_MINIMA) {
    motivos.push(`Asistencia ${formatearAsistencia(r.asistencia ?? 0)} % (mínimo ${ASISTENCIA_MINIMA} %)`);
  }
  if (r.evaluaciones === 0 && r.sesiones === 0) motivos.push("Aún no hay evaluaciones ni sesiones dictadas que acrediten el curso");
  return { apto: motivos.length === 0, motivos };
}
