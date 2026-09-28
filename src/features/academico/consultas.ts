import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { EstadoInscripcion, EstadoPago, MetodoPago, Modalidad, TipoContenido } from "@/types/dominio";

/** PostgREST devuelve objeto o arreglo según detecte la relación; esto lo normaliza. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const uno = <T,>(x: any): T | null => (Array.isArray(x) ? (x[0] ?? null) : (x ?? null));

export interface InscripcionEstudiante {
  id: string;
  codigo: string;
  estado: EstadoInscripcion;
  fecha_inscripcion: string;
  curso: {
    id: string;
    slug: string;
    titulo: string;
    modalidad: Modalidad;
    duracion_horas: number;
    categoria: { nombre: string; slug: string } | null;
  };
  pago: {
    id: string;
    monto: number;
    metodo: MetodoPago;
    estado: EstadoPago;
    fecha_pago: string | null;
    comprobante: { tipo: string; serie: string; numero: string; pdf_url: string | null } | null;
  } | null;
  certificado: { codigo_unico: string; fecha_emision: string } | null;
  progreso: { completadas: number; total: number; porcentaje: number };
}

/**
 * Progreso por inscripción (HU-28), calculado con las lecciones completadas
 * frente al total de contenidos del curso. Funciona con las políticas RLS del
 * estudiante, del instructor del curso y del administrador.
 */
export async function calcularProgreso(filas: { inscripcionId: string; cursoId: string }[]) {
  const resultado = new Map<string, { completadas: number; total: number; porcentaje: number }>();
  if (!filas.length) return resultado;
  const supabase = await createClient();
  const cursos = [...new Set(filas.map((f) => f.cursoId))];

  const [{ data: modulos }, { data: completados }] = await Promise.all([
    supabase.from("modulos").select("curso_id, contenidos(id)").in("curso_id", cursos),
    supabase
      .from("contenidos_completados")
      .select("inscripcion_id")
      .in(
        "inscripcion_id",
        filas.map((f) => f.inscripcionId),
      ),
  ]);

  const totalPorCurso = new Map<string, number>();
  (modulos ?? []).forEach((m: { curso_id: string; contenidos: unknown[] }) =>
    totalPorCurso.set(m.curso_id, (totalPorCurso.get(m.curso_id) ?? 0) + (m.contenidos?.length ?? 0)),
  );
  const hechas = new Map<string, number>();
  (completados ?? []).forEach((c: { inscripcion_id: string }) => hechas.set(c.inscripcion_id, (hechas.get(c.inscripcion_id) ?? 0) + 1));

  filas.forEach((f) => {
    const total = totalPorCurso.get(f.cursoId) ?? 0;
    const completadas = Math.min(hechas.get(f.inscripcionId) ?? 0, total);
    resultado.set(f.inscripcionId, { completadas, total, porcentaje: total ? Math.round((completadas / total) * 100) : 0 });
  });
  return resultado;
}

// HU-10 · Mis cursos (inscripciones del estudiante con pago, certificado y progreso)
export async function listarMisInscripciones(estudianteId: string): Promise<InscripcionEstudiante[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inscripciones")
    .select(
      `id, codigo, estado, fecha_inscripcion,
       curso:cursos(id, slug, titulo, modalidad, duracion_horas, categoria:categorias(nombre, slug)),
       pagos(id, monto, metodo, estado, fecha_pago, comprobantes(tipo, serie, numero, pdf_url)),
       certificados(codigo_unico, fecha_emision)`,
    )
    .eq("estudiante_id", estudianteId)
    .order("fecha_inscripcion", { ascending: false });
  if (error) throw new Error(`Inscripciones: ${error.message}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filas = (data ?? []) as any[];
  const progreso = await calcularProgreso(
    filas.filter((f) => f.estado === "CONFIRMADA").map((f) => ({ inscripcionId: f.id, cursoId: uno<{ id: string }>(f.curso)!.id })),
  );

  return filas.map((f) => {
    const curso = uno<InscripcionEstudiante["curso"]>(f.curso)!;
    const pago = uno<Record<string, unknown>>(f.pagos);
    return {
      id: f.id,
      codigo: f.codigo,
      estado: f.estado,
      fecha_inscripcion: f.fecha_inscripcion,
      curso: { ...curso, categoria: uno(curso.categoria) },
      pago: pago
        ? {
            id: pago.id as string,
            monto: Number(pago.monto),
            metodo: pago.metodo as MetodoPago,
            estado: pago.estado as EstadoPago,
            fecha_pago: pago.fecha_pago as string | null,
            comprobante: uno(pago.comprobantes),
          }
        : null,
      certificado: uno(f.certificados),
      progreso: progreso.get(f.id) ?? { completadas: 0, total: 0, porcentaje: 0 },
    };
  });
}

export interface SesionProxima {
  id: number;
  fecha: string;
  hora_inicio: string;
  duracion_minutos: number;
  modalidad: Modalidad;
  enlace_virtual: string | null;
  curso: { id: string; titulo: string; categoria: string | null };
}

/** Sesiones desde hoy de un conjunto de cursos, en orden cronológico. */
export async function listarSesionesProximas(cursoIds: string[], desde: string, limite = 5): Promise<SesionProxima[]> {
  if (!cursoIds.length) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("sesiones")
    .select("id, fecha, hora_inicio, duracion_minutos, modalidad, enlace_virtual, curso:cursos(id, titulo, categoria:categorias(slug))")
    .in("curso_id", cursoIds)
    .gte("fecha", desde)
    .order("fecha")
    .order("hora_inicio")
    .limit(limite);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((s) => {
    const curso = uno<{ id: string; titulo: string; categoria: unknown }>(s.curso)!;
    return { ...s, curso: { id: curso.id, titulo: curso.titulo, categoria: uno<{ slug: string }>(curso.categoria)?.slug ?? null } };
  });
}

export interface EvaluacionEstudiante {
  id: number;
  titulo: string;
  puntaje_total: number;
  intentos_permitidos: number;
  tiempo_limite_min: number | null;
  curso: { id: string; titulo: string };
  inscripcionId: string;
  intentos: { numero_intento: number; puntaje_obtenido: number | null; fecha: string }[];
  mejor: number | null;
}

// HU-09 · Evaluaciones de los cursos confirmados del estudiante
export async function listarEvaluacionesEstudiante(inscripciones: { id: string; cursoId: string; titulo: string }[]) {
  if (!inscripciones.length) return [];
  const supabase = await createClient();
  const [{ data: evaluaciones }, { data: intentos }] = await Promise.all([
    supabase
      .from("evaluaciones")
      .select("id, titulo, puntaje_total, intentos_permitidos, tiempo_limite_min, curso_id")
      .in(
        "curso_id",
        inscripciones.map((i) => i.cursoId),
      )
      .order("id"),
    supabase
      .from("intentos_evaluacion")
      .select("evaluacion_id, inscripcion_id, numero_intento, puntaje_obtenido, fecha")
      .in(
        "inscripcion_id",
        inscripciones.map((i) => i.id),
      ),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((evaluaciones ?? []) as any[]).map((e): EvaluacionEstudiante => {
    const ins = inscripciones.find((i) => i.cursoId === e.curso_id)!;
    const propios = ((intentos ?? []) as { evaluacion_id: number; inscripcion_id: string; numero_intento: number; puntaje_obtenido: number | null; fecha: string }[])
      .filter((i) => i.evaluacion_id === e.id && i.inscripcion_id === ins.id)
      .sort((a, b) => a.numero_intento - b.numero_intento);
    const notas = propios.map((p) => Number(p.puntaje_obtenido ?? 0));
    return {
      id: e.id,
      titulo: e.titulo,
      puntaje_total: Number(e.puntaje_total),
      intentos_permitidos: e.intentos_permitidos,
      tiempo_limite_min: e.tiempo_limite_min,
      curso: { id: ins.cursoId, titulo: ins.titulo },
      inscripcionId: ins.id,
      intentos: propios,
      mejor: notas.length ? Math.max(...notas) : null,
    };
  });
}

export interface ContenidoAula {
  id: number;
  titulo: string;
  tipo: TipoContenido;
  url_archivo: string;
  orden: number;
}

export interface ModuloAula {
  id: number;
  titulo: string;
  orden: number;
  contenidos: ContenidoAula[];
}

/** Módulos y contenidos de un curso ordenados (RLS: inscritos confirmados, instructor o admin). */
export async function listarModulosConContenidos(cursoId: string): Promise<ModuloAula[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("modulos")
    .select("id, titulo, orden, contenidos(id, titulo, tipo, url_archivo, orden)")
    .eq("curso_id", cursoId)
    .order("orden");
  return ((data ?? []) as ModuloAula[]).map((m) => ({ ...m, contenidos: [...(m.contenidos ?? [])].sort((a, b) => a.orden - b.orden) }));
}
