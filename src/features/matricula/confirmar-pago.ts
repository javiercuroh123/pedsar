import "server-only";
import { revalidatePath } from "next/cache";
import { uno } from "@/features/academico/consultas";
import { notificarAdministradores, notificarUsuario } from "@/features/notificaciones/enviar";
import { registrarActividad } from "@/lib/auditoria";
import { programarCorreo } from "@/lib/email";
import { correoConfirmacionMatricula } from "@/lib/email/plantillas";
import { publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";
import type { MedioPago } from "@/types/dominio";

export type ResultadoConfirmacion = "CONFIRMADO" | "YA_APROBADO" | "SIN_CUPO" | "NO_ENCONTRADO";

interface DatosConfirmacion {
  /** Cargo u orden de la pasarela; no se envía en la validación manual. */
  referencia?: string | null;
  medio?: MedioPago | null;
  respuesta?: Json;
  /** Quien confirma: el estudiante (cargo), el administrador o null (webhook). */
  actor: string | null;
}

interface InscripcionDelPago {
  id: string;
  codigo: string;
  estado: string;
  estudiante_id: string;
  curso_id: string;
  estudiante: unknown;
  curso: unknown;
}

/**
 * Único punto de confirmación de un pago (cargo con tarjeta o Yape, webhook de la
 * pasarela y validación manual del administrador). Es idempotente: si dos vías
 * lo confirman a la vez, solo una gana. El comprobante lo emite la BD (trigger).
 */
export async function confirmarPago(pagoId: string, datos: DatosConfirmacion): Promise<ResultadoConfirmacion> {
  const db = createAdminClient();
  const { data: pago } = await db
    .from("pagos")
    .select("id, estado, inscripcion:inscripciones(id, codigo, estado, estudiante_id, curso_id, estudiante:perfiles(nombres, correo), curso:cursos(titulo))")
    .eq("id", pagoId)
    .maybeSingle();
  const ins = uno<InscripcionDelPago>(pago?.inscripcion);
  if (!pago || !ins) return "NO_ENCONTRADO";
  if (pago.estado === "APROBADO") return "YA_APROBADO";

  const { data: actualizado } = await db
    .from("pagos")
    .update({
      estado: "APROBADO",
      fecha_pago: new Date().toISOString(),
      observacion: null,
      ...(datos.referencia ? { referencia_pasarela: datos.referencia } : {}),
      ...(datos.medio ? { medio: datos.medio } : {}),
      ...(datos.respuesta !== undefined ? { respuesta_pasarela: datos.respuesta } : {}),
    })
    .eq("id", pagoId)
    .neq("estado", "APROBADO")
    .select("id")
    .maybeSingle();
  if (!actualizado) return "YA_APROBADO";

  const curso = uno<{ titulo: string }>(ins.curso)?.titulo ?? "tu curso";
  const confirmable = ins.estado !== "CANCELADA" || (await hayLugarPara(ins));
  await registrarActividad(datos.actor, "PAGO_APROBADO", {
    pago: pagoId,
    inscripcion: ins.codigo,
    referencia: datos.referencia ?? null,
    medio: datos.medio ?? null,
    ...(confirmable ? {} : { sin_cupo: true }),
  });

  if (!confirmable) {
    // Pago que llegó con la reserva ya vencida y sin lugar: hay que devolver el dinero.
    await notificarAdministradores(`Pago aprobado sin cupo · ${curso} · ${ins.codigo}: hay que reembolsar al estudiante`, "/admin/inscripciones");
    await notificarUsuario(ins.estudiante_id, `Recibimos tu pago de ${curso}, pero tu reserva ya había vencido y no quedan cupos. Te contactaremos para devolverte el dinero.`, "/estudiante/pagos");
    revalidar();
    return "SIN_CUPO";
  }

  await db.from("inscripciones").update({ estado: "CONFIRMADA", vence_en: null }).eq("id", ins.id);
  await notificarUsuario(ins.estudiante_id, `¡Tu inscripción en ${curso} fue confirmada! Ya puedes ingresar al aula virtual.`, "/estudiante/cursos");

  const estudiante = uno<{ nombres: string; correo: string }>(ins.estudiante);
  if (estudiante?.correo) {
    const { data: comprobante } = await db.from("comprobantes").select("id, serie, numero").eq("pago_id", pagoId).maybeSingle();
    const sitio = publicEnv.NEXT_PUBLIC_SITE_URL;
    programarCorreo({
      para: estudiante.correo,
      ...correoConfirmacionMatricula({
        nombre: estudiante.nombres || "estudiante",
        curso,
        codigo: ins.codigo,
        url: `${sitio}/estudiante/cursos`,
        comprobante: comprobante ? { numero: `${comprobante.serie}-${comprobante.numero}`, url: `${sitio}/comprobantes/${comprobante.id}/pdf` } : undefined,
      }),
    });
  }
  revalidar();
  return "CONFIRMADO";
}

/** Una reserva vencida se reactiva si queda cupo y el estudiante no se volvió a inscribir. */
async function hayLugarPara(ins: InscripcionDelPago) {
  const db = createAdminClient();
  const { data: cupo } = await db.rpc("cupo_disponible", { p_curso: ins.curso_id });
  if (!cupo || cupo <= 0) return false;
  const { data: otras } = await db
    .from("inscripciones")
    .select("id")
    .eq("estudiante_id", ins.estudiante_id)
    .eq("curso_id", ins.curso_id)
    .neq("estado", "CANCELADA")
    .neq("id", ins.id);
  return !otras?.length;
}

function revalidar() {
  revalidatePath("/estudiante", "layout");
  revalidatePath("/admin", "layout");
}
