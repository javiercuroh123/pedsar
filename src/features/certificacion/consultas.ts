import "server-only";
import type { ResultadoAcademico } from "@/config/academico";
import type { InscripcionEstudiante } from "@/features/academico/consultas";
import { createClient } from "@/lib/supabase/server";
import type { DatosCertificado } from "./vista-certificado";

/** Datos para mostrar un certificado emitido: los congelados al emitir o, si faltan, los actuales. */
export function datosCertificado(i: InscripcionEstudiante, nombreActual: string): DatosCertificado {
  const c = i.certificado!;
  return {
    estudiante: c.estudiante_nombre || nombreActual,
    curso: c.curso_titulo || i.curso.titulo,
    duracion_horas: c.duracion_horas ?? i.curso.duracion_horas,
    fecha_emision: c.fecha_emision,
    codigo_unico: c.codigo_unico,
    instructor: c.instructor_nombre,
    nota_final: c.nota_final === null ? null : Number(c.nota_final),
  };
}

export interface CertificadoVerificado {
  codigo_unico: string;
  estudiante: string;
  curso: string;
  duracion_horas: number;
  fecha_emision: string;
  nota_final: number | null;
  instructor: string | null;
}

// Los tipos generados no reflejan que una función puede devolver null en sus columnas.
const numeroONull = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const textoONull = (v: unknown) => (typeof v === "string" && v ? v : null);

/** Verificación pública del certificado por su código (HU-11, Figura 15). */
export async function verificarCertificado(codigo: string): Promise<CertificadoVerificado | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("verificar_certificado", { p_codigo: codigo });
  if (error) throw new Error(`Verificación: ${error.message}`);
  const fila = data?.[0];
  return fila ? { ...fila, nota_final: numeroONull(fila.nota_final), instructor: textoONull(fila.instructor) } : null;
}

/** Nota final, asistencia y avance por inscripción (RLS: cada rol ve solo lo suyo). */
export async function obtenerResultados(inscripciones: string[]): Promise<Map<string, ResultadoAcademico>> {
  if (!inscripciones.length) return new Map();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("resultado_academico", { p_inscripciones: inscripciones });
  if (error) throw new Error(`Resultado académico: ${error.message}`);
  return new Map(
    (data ?? []).map((r) => [
      r.inscripcion_id,
      { ...r, nota_final: numeroONull(r.nota_final), asistencia: numeroONull(r.asistencia), progreso: numeroONull(r.progreso) },
    ]),
  );
}
