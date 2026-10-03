import "server-only";
import { revalidatePath } from "next/cache";
import { uno } from "@/features/academico/consultas";
import { notificarAdministradores, notificarUsuario } from "@/features/notificaciones/enviar";
import { registrarActividad } from "@/lib/auditoria";
import { programarCorreo } from "@/lib/email";
import { correoConfirmacionMatricula } from "@/lib/email/plantillas";
import { publicEnv } from "@/lib/env";
import { getPasarela } from "@/lib/pagos";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";
import type { EstadoPago, MedioPago } from "@/types/dominio";

export type ResultadoConfirmacion = "CONFIRMADO" | "YA_APROBADO" | "DUPLICADO" | "SIN_CUPO" | "NO_ENCONTRADO";

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

/** Estados desde los que un pago puede aprobarse; un pago REEMBOLSADO nunca vuelve a APROBADO. */
const APROBABLE: EstadoPago[] = ["PENDIENTE", "VENCIDO", "RECHAZADO"];

/**
 * Único punto de confirmación de un pago (cargo con tarjeta o Yape, webhook de la
 * pasarela, conciliación y validación manual del administrador). Es idempotente: si
 * dos vías lo confirman a la vez, solo una gana; un segundo cobro con otra referencia
 * se avisa para reembolsar. El comprobante lo emite la BD (trigger). Los errores de la
 * BD se lanzan para que el webhook responda 500 y la pasarela reintente.
 */
export async function confirmarPago(pagoId: string, datos: DatosConfirmacion): Promise<ResultadoConfirmacion> {
  const db = createAdminClient();
  const { data: pago, error: errorLectura } = await db
    .from("pagos")
    .select(
      "id, estado, referencia_pasarela, inscripcion:inscripciones(id, codigo, estado, estudiante_id, curso_id, estudiante:perfiles(nombres, correo), curso:cursos(titulo))",
    )
    .eq("id", pagoId)
    .maybeSingle();
  if (errorLectura) throw new Error(`No se pudo leer el pago: ${errorLectura.message}`);
  const ins = uno<InscripcionDelPago>(pago?.inscripcion);
  if (!pago || !ins) return "NO_ENCONTRADO";
  const curso = uno<{ titulo: string }>(ins.curso)?.titulo ?? "tu curso";

  if (!APROBABLE.includes(pago.estado as EstadoPago)) {
    // Ya procesado: un cobro con otra referencia es dinero recibido dos veces.
    if (datos.referencia && pago.referencia_pasarela && datos.referencia !== pago.referencia_pasarela) {
      await registrarActividad(datos.actor, "PAGO_DUPLICADO", { pago: pagoId, inscripcion: ins.codigo, referencia: datos.referencia, anterior: pago.referencia_pasarela });
      await notificarAdministradores(
        `Pago duplicado · ${curso} · ${ins.codigo}: Culqi cobró ${datos.referencia} además de ${pago.referencia_pasarela}. Reembolsa el duplicado en CulqiPanel.`,
        "/admin/inscripciones",
      );
      return "DUPLICADO";
    }
    // Un reintento completa la matrícula de un pago aprobado que no llegó a confirmarse.
    if (pago.estado !== "APROBADO" || ins.estado !== "PENDIENTE") return "YA_APROBADO";
  } else {
    const { data: actualizado, error } = await db
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
      .in("estado", APROBABLE)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(`No se pudo aprobar el pago: ${error.message}`);
    if (!actualizado) return "YA_APROBADO";
    await registrarActividad(datos.actor, "PAGO_APROBADO", {
      pago: pagoId,
      inscripcion: ins.codigo,
      referencia: datos.referencia ?? null,
      medio: datos.medio ?? null,
    });
  }

  if (ins.estado === "CANCELADA" && !(await hayLugarPara(ins))) {
    // Pago que llegó con la reserva ya vencida y sin lugar: hay que devolver el dinero.
    await registrarActividad(datos.actor, "PAGO_SIN_CUPO", { pago: pagoId, inscripcion: ins.codigo });
    await notificarAdministradores(`Pago aprobado sin cupo · ${curso} · ${ins.codigo}: hay que reembolsar al estudiante`, "/admin/inscripciones");
    await notificarUsuario(ins.estudiante_id, `Recibimos tu pago de ${curso}, pero tu reserva ya había vencido y no quedan cupos. Te contactaremos para devolverte el dinero.`, "/estudiante/pagos");
    revalidar();
    return "SIN_CUPO";
  }

  const { error: errorInscripcion } = await db.from("inscripciones").update({ estado: "CONFIRMADA", vence_en: null }).eq("id", ins.id);
  if (errorInscripcion) {
    await notificarAdministradores(`Pago aprobado de ${ins.codigo}, pero no se pudo confirmar la matrícula: ${errorInscripcion.message}`, "/admin/inscripciones");
    throw new Error(`No se pudo confirmar la matrícula: ${errorInscripcion.message}`);
  }
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

export type ResultadoConciliacion = ResultadoConfirmacion | "NO_PAGADO" | "MONTO_DISTINTO" | "SIN_REFERENCIA";

/**
 * Conciliación: si el aviso de la pasarela no llegó, se pregunta a Culqi por la orden
 * (o el cargo) del pago y, si está pagada con el monto correcto, se confirma. Se sigue
 * confiando en la API de la pasarela, no en quien pide verificar.
 */
export async function conciliarPago(pagoId: string, actor: string | null): Promise<ResultadoConciliacion> {
  const { data: pago } = await createAdminClient()
    .from("pagos")
    .select("id, metodo, monto, orden_pasarela, referencia_pasarela")
    .eq("id", pagoId)
    .maybeSingle();
  if (!pago) return "NO_ENCONTRADO";
  const aviso = pago.orden_pasarela
    ? ({ tipo: "orden", id: pago.orden_pasarela } as const)
    : pago.referencia_pasarela?.startsWith("chr_")
      ? ({ tipo: "cargo", id: pago.referencia_pasarela } as const)
      : null;
  if (!aviso) return "SIN_REFERENCIA";

  const consulta = await getPasarela("culqi").consultar(aviso);
  if (consulta.estado !== "PAGADO") return "NO_PAGADO";
  if (consulta.montoCentimos !== Math.round(Number(pago.monto) * 100)) return "MONTO_DISTINTO";
  return confirmarPago(pagoId, { referencia: consulta.referencia, medio: consulta.medio, respuesta: consulta.respuesta, actor });
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
