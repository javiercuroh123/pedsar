"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { aprobado } from "@/config/academico";
import { registrarActividad } from "@/lib/auditoria";
import { requireRol } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { EstadoFormulario } from "@/features/usuarios/esquemas";

const completarSchema = z.object({ inscripcionId: z.uuid(), contenidoId: z.coerce.number().int(), cursoId: z.uuid() });

/** Recalcula la tabla `progreso` de una inscripción (la usan reportes y el portal del instructor). */
async function actualizarProgreso(inscripcionId: string, cursoId: string) {
  const admin = createAdminClient();
  const [{ data: modulos }, { count }] = await Promise.all([
    admin.from("modulos").select("contenidos(id)").eq("curso_id", cursoId),
    admin.from("contenidos_completados").select("contenido_id", { head: true, count: "exact" }).eq("inscripcion_id", inscripcionId),
  ]);
  const total = (modulos ?? []).reduce((a: number, m: { contenidos: unknown[] }) => a + (m.contenidos?.length ?? 0), 0);
  const hechas = Math.min(count ?? 0, total);
  await admin.from("progreso").upsert({
    inscripcion_id: inscripcionId,
    lecciones_completadas: hechas,
    total_lecciones: total,
    porcentaje: total ? Math.round((hechas / total) * 10000) / 100 : 0,
    actualizado_en: new Date().toISOString(),
  });
}

// HU-28 · Marcar lección como completada
export async function marcarCompletado(formData: FormData) {
  const estudiante = await requireRol("estudiante");
  const { inscripcionId, contenidoId, cursoId } = completarSchema.parse(Object.fromEntries(formData));
  const supabase = await createClient();

  // RLS: solo puede marcar en sus propias inscripciones.
  const { error } = await supabase.from("contenidos_completados").insert({ inscripcion_id: inscripcionId, contenido_id: contenidoId });
  if (error && error.code !== "23505") throw new Error(error.message);

  const { data: propia } = await supabase.from("inscripciones").select("id").eq("id", inscripcionId).eq("estudiante_id", estudiante.id).maybeSingle();
  if (propia) await actualizarProgreso(inscripcionId, cursoId);
  revalidatePath(`/estudiante/cursos/${cursoId}`);
}

export interface ResultadoEvaluacion {
  ok: boolean;
  mensaje?: string;
  puntaje?: number;
  total?: number;
  correctas?: number;
  preguntas?: number;
  aprobado?: boolean;
  intentosRestantes?: number;
}

const respuestasSchema = z.record(z.string(), z.string());

/**
 * HU-09 · Rendir evaluación con calificación automática.
 * Las respuestas correctas nunca llegan al navegador: se califican aquí con el
 * cliente admin después de verificar la inscripción y los intentos disponibles.
 */
export async function enviarEvaluacion(evaluacionId: number, respuestas: Record<string, string>): Promise<ResultadoEvaluacion> {
  const estudiante = await requireRol("estudiante");
  const resp = respuestasSchema.parse(respuestas);
  const admin = createAdminClient();

  const { data: evaluacion } = await admin
    .from("evaluaciones")
    .select("id, curso_id, puntaje_total, intentos_permitidos, preguntas(id, respuesta_correcta, puntaje)")
    .eq("id", evaluacionId)
    .single();
  if (!evaluacion) return { ok: false, mensaje: "Evaluación no encontrada" };

  const { data: inscripcion } = await admin
    .from("inscripciones")
    .select("id")
    .eq("curso_id", evaluacion.curso_id)
    .eq("estudiante_id", estudiante.id)
    .eq("estado", "CONFIRMADA")
    .maybeSingle();
  if (!inscripcion) return { ok: false, mensaje: "No estás inscrito en este curso" };

  const { count } = await admin
    .from("intentos_evaluacion")
    .select("id", { head: true, count: "exact" })
    .eq("inscripcion_id", inscripcion.id)
    .eq("evaluacion_id", evaluacionId);
  const usados = count ?? 0;
  if (usados >= evaluacion.intentos_permitidos) return { ok: false, mensaje: "Ya usaste todos tus intentos" };

  const preguntas = (evaluacion.preguntas ?? []) as { id: number; respuesta_correcta: string; puntaje: number }[];
  const sumaPuntajes = preguntas.reduce((a, p) => a + Number(p.puntaje), 0) || 1;
  const total = Number(evaluacion.puntaje_total);
  let correctas = 0;
  let bruto = 0;
  preguntas.forEach((p) => {
    if (resp[String(p.id)] === p.respuesta_correcta) {
      correctas++;
      bruto += Number(p.puntaje);
    }
  });
  // Escala el puntaje de las preguntas al puntaje total de la evaluación (p. ej. 20).
  const puntaje = Math.round((bruto / sumaPuntajes) * total * 100) / 100;

  const { error } = await admin.from("intentos_evaluacion").insert({
    inscripcion_id: inscripcion.id,
    evaluacion_id: evaluacionId,
    numero_intento: usados + 1,
    respuestas: resp,
    puntaje_obtenido: puntaje,
  });
  if (error) return { ok: false, mensaje: "No se pudo registrar el intento. Inténtalo de nuevo." };

  await registrarActividad(estudiante.id, "RENDIR_EVALUACION", { evaluacion: evaluacionId, puntaje, intento: usados + 1 });
  revalidatePath("/estudiante", "layout");

  return {
    ok: true,
    puntaje,
    total,
    correctas,
    preguntas: preguntas.length,
    aprobado: aprobado(puntaje, total),
    intentosRestantes: evaluacion.intentos_permitidos - usados - 1,
  };
}

const reembolsoSchema = z.object({
  pagoId: z.uuid(),
  motivo: z.string().trim().min(10, "Describe el motivo (mínimo 10 caracteres)").max(500),
});

// HU-31 · Solicitud de reembolso
export async function solicitarReembolso(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const estudiante = await requireRol("estudiante");
  const datos = reembolsoSchema.safeParse(Object.fromEntries(formData));
  if (!datos.success) return { ok: false, mensaje: datos.error.issues[0]?.message ?? "Datos no válidos" };

  const supabase = await createClient();
  const { data: pago } = await supabase.from("pagos").select("id, monto, estado").eq("id", datos.data.pagoId).maybeSingle();
  if (!pago || pago.estado !== "APROBADO") return { ok: false, mensaje: "Solo se pueden reembolsar pagos aprobados" };

  const { data: existente } = await supabase.from("reembolsos").select("id").eq("pago_id", pago.id).in("estado", ["SOLICITADO", "APROBADO"]).maybeSingle();
  if (existente) return { ok: false, mensaje: "Ya existe una solicitud de reembolso para este pago" };

  const { error } = await supabase.from("reembolsos").insert({ pago_id: pago.id, motivo: datos.data.motivo, monto: pago.monto });
  if (error) return { ok: false, mensaje: error.message };

  await registrarActividad(estudiante.id, "SOLICITAR_REEMBOLSO", { pago: pago.id });
  revalidatePath("/estudiante/pagos");
  return { ok: true, mensaje: "Solicitud enviada. Te responderemos por correo." };
}
