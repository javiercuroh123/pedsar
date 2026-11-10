"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { aprobado } from "@/config/academico";
import { DIAS_ANTICIPACION_REEMBOLSO, dentroDePlazoReembolso } from "@/config/matricula";
import { uno } from "@/features/academico/consultas";
import { registrarActividad } from "@/lib/auditoria";
import { requireRol } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { EstadoFormulario } from "@/features/usuarios/esquemas";

const completarSchema = z.object({ inscripcionId: z.uuid(), contenidoId: z.coerce.number().int().positive() });

// El curso se deduce de la matrícula; RLS comprueba la pertenencia del contenido
// y un trigger recalcula el progreso dentro de la misma transacción.
export async function marcarCompletado(formData: FormData) {
  const estudiante = await requireRol("estudiante");
  const { inscripcionId, contenidoId } = completarSchema.parse(Object.fromEntries(formData));
  const supabase = await createClient();
  const { data: propia, error: errorLectura } = await supabase.from("inscripciones").select("id, curso_id")
    .eq("id", inscripcionId).eq("estudiante_id", estudiante.id).eq("estado", "CONFIRMADA").maybeSingle();
  if (errorLectura || !propia) throw new Error("No tienes una matrícula confirmada para esta lección");
  const { error } = await supabase.from("contenidos_completados").insert({ inscripcion_id: inscripcionId, contenido_id: contenidoId });
  if (error && error.code !== "23505") throw new Error("No se pudo completar la lección de este curso");
  revalidatePath(`/estudiante/cursos/${propia.curso_id}`);
  revalidatePath("/estudiante", "layout");
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

export async function iniciarEvaluacion(evaluacionId: number) {
  const estudiante = await requireRol("estudiante");
  z.number().int().positive().parse(evaluacionId);
  const db = createAdminClient();
  const { data: sesion, error } = await db.rpc("iniciar_evaluacion", { p_estudiante: estudiante.id, p_evaluacion: evaluacionId }).single();
  if (error || !sesion) return { ok: false as const, mensaje: error?.message ?? "No se pudo iniciar la evaluación" };
  // Las preguntas se entregan DESPUÉS de iniciar el plazo; nunca sus respuestas.
  const { data: preguntas, error: errorPreguntas } = await db.from("preguntas")
    .select("id, enunciado, opciones, puntaje").eq("evaluacion_id", evaluacionId).order("id");
  if (errorPreguntas || !preguntas?.length) return { ok: false as const, mensaje: "No se pudieron cargar las preguntas. Vuelve a intentarlo." };
  return { ok: true as const, sesion, preguntas: preguntas.map((p) => ({ ...p, opciones: p.opciones as string[], puntaje: Number(p.puntaje) })) };
}

export async function enviarEvaluacion(evaluacionId: number, respuestas: Record<string, string>, intento: number): Promise<ResultadoEvaluacion> {
  const estudiante = await requireRol("estudiante");
  z.number().int().positive().parse(evaluacionId);
  z.number().int().positive().parse(intento);
  const resp = z.record(z.string().max(30), z.string().max(10000)).parse(respuestas);
  const { data: resultado, error } = await createAdminClient().rpc("entregar_evaluacion", {
    p_estudiante: estudiante.id, p_evaluacion: evaluacionId, p_intento: intento, p_respuestas: resp,
  }).single();
  if (error || !resultado) return { ok: false, mensaje: error?.message ?? "No se pudo registrar el intento. Inténtalo de nuevo." };
  await registrarActividad(estudiante.id, "RENDIR_EVALUACION", { evaluacion: evaluacionId, puntaje: resultado.puntaje, intento });
  revalidatePath("/estudiante", "layout");
  return { ok: true, puntaje: Number(resultado.puntaje), total: Number(resultado.total), correctas: resultado.correctas,
    preguntas: resultado.preguntas, aprobado: aprobado(Number(resultado.puntaje), Number(resultado.total)),
    intentosRestantes: resultado.intentos_restantes,
    ...(resultado.fuera_de_plazo ? { mensaje: "El plazo venció. Este intento se registró sin respuestas válidas." } : {}),
  };
}

const reembolsoSchema = z.object({
  pagoId: z.uuid(),
  motivo: z.string().trim().min(10, "Describe el motivo (mínimo 10 caracteres)").max(500),
});

// HU-31 · HU-50 · Solicitud de reembolso (hasta 7 días antes del inicio del curso)
export async function solicitarReembolso(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const estudiante = await requireRol("estudiante");
  const datos = reembolsoSchema.safeParse(Object.fromEntries(formData));
  if (!datos.success) return { ok: false, mensaje: datos.error.issues[0]?.message ?? "Datos no válidos" };

  const supabase = await createClient();
  const { data: pago } = await supabase
    .from("pagos")
    .select("id, monto, estado, inscripcion:inscripciones(curso:cursos(sesiones(fecha)))")
    .eq("id", datos.data.pagoId)
    .maybeSingle();
  if (!pago || pago.estado !== "APROBADO") return { ok: false, mensaje: "Solo se pueden reembolsar pagos aprobados" };

  const sesiones = (
    uno<{ sesiones?: { fecha: string }[] }>(uno<{ curso?: unknown }>((pago as { inscripcion?: unknown }).inscripcion)?.curso)?.sesiones ?? []
  )
    .map((s) => s.fecha)
    .sort();
  if (!dentroDePlazoReembolso(sesiones[0] ?? null)) {
    return {
      ok: false,
      mensaje: `Las solicitudes de reembolso se atienden hasta ${DIAS_ANTICIPACION_REEMBOLSO} días antes del inicio del curso`,
    };
  }

  const { data: existente } = await supabase.from("reembolsos").select("id").eq("pago_id", pago.id).in("estado", ["SOLICITADO", "APROBADO"]).maybeSingle();
  if (existente) return { ok: false, mensaje: "Ya existe una solicitud de reembolso para este pago" };

  const { error } = await supabase.from("reembolsos").insert({ pago_id: pago.id, motivo: datos.data.motivo, monto: pago.monto });
  if (error) return { ok: false, mensaje: error.message };

  await registrarActividad(estudiante.id, "SOLICITAR_REEMBOLSO", { pago: pago.id });
  revalidatePath("/estudiante/pagos");
  return { ok: true, mensaje: "Solicitud enviada. Te responderemos por correo." };
}
