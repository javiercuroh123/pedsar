import "server-only";
import { ASISTENCIA_MINIMA, evaluarAptitud, NOTA_MINIMA } from "@/config/academico";
import { obtenerResultados } from "@/features/certificacion/consultas";
import { hoyISO } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";
import type { EstadoAsistencia } from "@/types/dominio";
import { listarEstudiantesDelCurso, type CursoInstructor, type EstudianteCurso } from "./consultas-instructor";

export type EstadoAcademico = "APTO" | "EN_RIESGO" | "EN_CURSO";

export interface FilaEstudiante extends EstudianteCurso {
  /** Mejor puntaje de cada evaluación, en el orden de `evaluaciones` (null si no la rindió). */
  notas: (number | null)[];
  /** Promedio vigesimal solo de las evaluaciones rendidas (para seguir el curso en marcha). */
  notaParcial: number | null;
  /** Nota final como la del certificado: las no rendidas cuentan 0. */
  notaFinal: number | null;
  rendidas: number;
  asistencia: number | null;
  presentes: number;
  progreso: number;
  /** Estado de cada sesión dictada, en el orden de `sesiones`. */
  asistenciaPorSesion: (EstadoAsistencia | null)[];
  estado: EstadoAcademico;
  motivos: string[];
}

export interface ReporteCurso {
  curso: CursoInstructor;
  evaluaciones: { id: number; titulo: string; puntaje_total: number }[];
  /** Sesiones ya dictadas (hasta hoy). */
  sesiones: { id: number; fecha: string; hora_inicio: string }[];
  estudiantes: FilaEstudiante[];
}

export const ETIQUETA_ESTADO_ACADEMICO: Record<EstadoAcademico, string> = { APTO: "Apto", EN_RIESGO: "En riesgo", EN_CURSO: "En curso" };

/**
 * HU-42 · Calificaciones, asistencia y avance de los estudiantes de un curso, con la misma
 * nota final y los mismos requisitos que los certificados (resultado_academico + evaluarAptitud).
 * «En riesgo»: asistencia o promedio parcial por debajo del mínimo. El llamador debe haber
 * comprobado que el curso pertenece al instructor (listarCursosDelInstructor).
 */
export async function reporteDelCurso(curso: CursoInstructor): Promise<ReporteCurso> {
  const supabase = await createClient();
  const estudiantes = await listarEstudiantesDelCurso(curso.id);
  const ids = estudiantes.map((e) => e.inscripcionId);
  const [{ data: evaluaciones }, { data: sesiones }, { data: intentos }, { data: asistencias }, resultados] = await Promise.all([
    supabase.from("evaluaciones").select("id, titulo, puntaje_total").eq("curso_id", curso.id).order("id"),
    supabase.from("sesiones").select("id, fecha, hora_inicio").eq("curso_id", curso.id).lte("fecha", hoyISO()).order("fecha").order("hora_inicio"),
    ids.length ? supabase.from("intentos_evaluacion").select("inscripcion_id, evaluacion_id, puntaje_obtenido").in("inscripcion_id", ids) : Promise.resolve({ data: [] }),
    ids.length ? supabase.from("asistencias").select("inscripcion_id, sesion_id, estado").in("inscripcion_id", ids) : Promise.resolve({ data: [] }),
    obtenerResultados(ids),
  ]);
  const evs = (evaluaciones ?? []).map((e) => ({ ...e, puntaje_total: Number(e.puntaje_total) }));

  const filas = estudiantes.map((s): FilaEstudiante => {
    const notas = evs.map((e) => {
      const propias = (intentos ?? []).filter((t) => t.inscripcion_id === s.inscripcionId && t.evaluacion_id === e.id && t.puntaje_obtenido !== null);
      return propias.length ? Math.max(...propias.map((t) => Number(t.puntaje_obtenido))) : null;
    });
    const vigesimales = notas.flatMap((n, i) => (n === null || !evs[i].puntaje_total ? [] : [(n / evs[i].puntaje_total) * 20]));
    const notaParcial = vigesimales.length ? vigesimales.reduce((a, b) => a + b, 0) / vigesimales.length : null;
    const r = resultados.get(s.inscripcionId);
    const { apto, motivos } = evaluarAptitud(r);
    const riesgo =
      (!!r?.sesiones && (r.asistencia ?? 0) < ASISTENCIA_MINIMA) || (notaParcial !== null && notaParcial < NOTA_MINIMA);
    return {
      ...s,
      notas,
      notaParcial,
      notaFinal: r?.nota_final ?? null,
      rendidas: r?.rendidas ?? vigesimales.length,
      asistencia: r?.sesiones ? (r.asistencia ?? 0) : null,
      presentes: r?.presentes ?? 0,
      progreso: Math.round(r?.progreso ?? 0),
      asistenciaPorSesion: (sesiones ?? []).map(
        (se) => ((asistencias ?? []).find((a) => a.inscripcion_id === s.inscripcionId && a.sesion_id === se.id)?.estado as EstadoAsistencia | undefined) ?? null,
      ),
      estado: apto ? "APTO" : riesgo ? "EN_RIESGO" : "EN_CURSO",
      motivos,
    };
  });

  return { curso, evaluaciones: evs, sesiones: sesiones ?? [], estudiantes: filas };
}
