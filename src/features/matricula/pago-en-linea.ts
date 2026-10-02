"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { reservaVencida } from "@/config/matricula";
import { uno } from "@/features/academico/consultas";
import { confirmarPago, type ResultadoConfirmacion } from "@/features/matricula/confirmar-pago";
import { registrarActividad } from "@/lib/auditoria";
import { requireRol } from "@/lib/auth";
import { publicEnv } from "@/lib/env";
import { ErrorPasarela, getPasarela, pagoManualHabilitado, pasarelaActiva, type Autenticacion3DS } from "@/lib/pagos";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";
import type { EstadoPago } from "@/types/dominio";

/** Lo que necesita el Checkout Custom de Culqi en el navegador. */
export interface DatosCheckout {
  llavePublica: string;
  montoCentimos: number;
  /** null si Culqi no aceptó la orden: se paga solo con tarjeta o Yape. */
  ordenId: string | null;
  correo: string;
  nombres: string;
  apellidos: string;
  titulo: string;
}

export interface ResultadoPagoEnLinea {
  estado: "APROBADO" | "RECHAZADO" | "REQUIERE_3DS" | "ERROR";
  mensaje: string;
}

interface InscripcionPorPagar {
  id: string;
  codigo: string;
  estado: string;
  vence_en: string | null;
  curso: unknown;
  estudiante: unknown;
}

const NO_DISPONIBLE = "El pago en línea aún no está disponible";
const SIN_RESPUESTA =
  "No pudimos confirmar el resultado con la pasarela. Si se te descontó, tu matrícula se confirmará sola en unos minutos; no vuelvas a pagar por ahora.";

/** Qué decirle al estudiante según cómo terminó la confirmación de un cobro aprobado. */
const MENSAJE_CONFIRMACION: Record<ResultadoConfirmacion, string> = {
  CONFIRMADO: "¡Pago aprobado! Tu matrícula está confirmada.",
  YA_APROBADO: "¡Pago aprobado! Tu matrícula está confirmada.",
  NO_ENCONTRADO: "¡Pago aprobado! Tu matrícula está confirmada.",
  SIN_CUPO: "Recibimos tu pago, pero tu reserva ya había vencido y no quedan cupos. Te devolveremos el dinero.",
  DUPLICADO: "Este curso ya estaba pagado: PEDSAR revisará el cobro duplicado y te devolverá el dinero.",
};

/**
 * Pago CULQI pendiente del estudiante con sesión (RLS garantiza que es suyo) y con
 * la reserva vigente. Se valida igual al preparar el checkout y al cobrar.
 */
async function pagoPorPagar(pagoId: string) {
  const supabase = await createClient();
  const { data: pago } = await supabase
    .from("pagos")
    .select("id, estado, metodo, monto, orden_pasarela, inscripcion:inscripciones(id, codigo, estado, vence_en, curso:cursos(titulo), estudiante:perfiles(telefono))")
    .eq("id", pagoId)
    .maybeSingle();
  const ins = uno<InscripcionPorPagar>(pago?.inscripcion);
  if (!pago || !ins) return { ok: false as const, mensaje: "No encontramos ese pago" };
  if (pago.metodo !== "CULQI") return { ok: false as const, mensaje: "Este pago no se hace en línea" };
  if (pago.estado !== "PENDIENTE" || ins.estado !== "PENDIENTE") return { ok: false as const, mensaje: "Este pago ya no está pendiente" };
  if (reservaVencida(ins)) return { ok: false as const, mensaje: "Tu reserva venció. Vuelve a inscribirte para pagar." };
  const titulo = uno<{ titulo: string }>(ins.curso)?.titulo ?? "Curso";
  return {
    ok: true as const,
    pago: { id: pago.id, monto: Number(pago.monto), orden: pago.orden_pasarela },
    ins,
    titulo,
    descripcion: `Inscripción ${ins.codigo} · ${titulo}`,
  };
}

/** HU-12 · Prepara el checkout: crea (o reutiliza) la orden de Culqi, que vence junto con la reserva. */
export async function prepararPagoEnLinea(
  pagoId: string,
): Promise<{ ok: true; checkout: DatosCheckout } | { ok: false; mensaje: string; aprobado?: true }> {
  const estudiante = await requireRol("estudiante");
  if (!pasarelaActiva()) return { ok: false, mensaje: NO_DISPONIBLE };
  const r = await pagoPorPagar(pagoId);
  if (!r.ok) return r;

  const pasarela = getPasarela("culqi");
  try {
    let ordenId = r.pago.orden;
    if (ordenId) {
      const anterior = await pasarela.consultar({ tipo: "orden", id: ordenId });
      if (anterior.estado === "PAGADO") {
        // El aviso de la pasarela no llegó: se confirma aquí, con lo que dice la API de Culqi.
        if (anterior.montoCentimos !== Math.round(r.pago.monto * 100)) {
          return { ok: false, mensaje: "Recibimos un pago con otro monto; PEDSAR lo revisará y te contactará." };
        }
        await confirmarPago(r.pago.id, { referencia: anterior.referencia, medio: anterior.medio, respuesta: anterior.respuesta, actor: estudiante.id });
        return { ok: false, aprobado: true, mensaje: "¡Ya recibimos tu pago! Tu matrícula quedó confirmada." };
      }
      if (anterior.estado !== "PENDIENTE") ordenId = null;
    }
    if (!ordenId) ordenId = await crearOrden(r, estudiante);
    return {
      ok: true,
      checkout: {
        llavePublica: publicEnv.NEXT_PUBLIC_CULQI_PUBLIC_KEY ?? "",
        montoCentimos: Math.round(r.pago.monto * 100),
        ordenId,
        correo: estudiante.correo,
        nombres: estudiante.nombres,
        apellidos: estudiante.apellidos,
        titulo: r.titulo,
      },
    };
  } catch (e) {
    if (e instanceof ErrorPasarela) return { ok: false, mensaje: e.message };
    throw e;
  }
}

/**
 * Orden de Culqi que vence junto con la reserva, para pagar con billetera, banca móvil o
 * agente. Si Culqi la rechaza (4xx), se registra el motivo y se sigue sin orden: la tarjeta
 * y Yape no la necesitan. Sin conexión con Culqi, el error sube.
 */
async function crearOrden(
  r: Extract<Awaited<ReturnType<typeof pagoPorPagar>>, { ok: true }>,
  estudiante: { nombres: string; apellidos: string; correo: string },
): Promise<string | null> {
  const venceEn = r.ins.vence_en ? new Date(r.ins.vence_en) : new Date(Date.now() + 48 * 3600 * 1000);
  try {
    const orden = await getPasarela("culqi").crearOrden({
      pagoId: r.pago.id,
      montoSoles: r.pago.monto,
      descripcion: r.descripcion,
      numeroOrden: `${r.ins.codigo}-${Date.now().toString(36)}`,
      cliente: {
        nombres: estudiante.nombres,
        apellidos: estudiante.apellidos,
        correo: estudiante.correo,
        telefono: uno<{ telefono: string | null }>(r.ins.estudiante)?.telefono ?? null,
      },
      venceEn,
    });
    await createAdminClient().from("pagos").update({ orden_pasarela: orden.id }).eq("id", r.pago.id);
    return orden.id;
  } catch (e) {
    if (e instanceof ErrorPasarela && e.status && e.status < 500) {
      console.error(`Culqi rechazó la orden del pago ${r.pago.id}:`, e.detalle);
      return null;
    }
    throw e;
  }
}

const textoCorto = z.string().min(1).max(200);
const cobroSchema = z.object({
  pagoId: z.uuid(),
  token: textoCorto,
  huella: textoCorto.optional(),
  autenticacion3DS: z
    .object({ eci: z.string(), xid: z.string(), cavv: z.string(), protocolVersion: z.string(), directoryServerTransactionId: z.string() })
    .optional(),
});

/** HU-12 · Cobra el token de tarjeta o Yape; si el banco pide 3DS, el navegador reintenta con sus parámetros. */
export async function cobrarConToken(entrada: { pagoId: string; token: string; huella?: string; autenticacion3DS?: Autenticacion3DS }): Promise<ResultadoPagoEnLinea> {
  const estudiante = await requireRol("estudiante");
  const d = cobroSchema.safeParse(entrada);
  if (!d.success) return { estado: "ERROR", mensaje: "Datos de pago no válidos" };
  if (!pasarelaActiva()) return { estado: "ERROR", mensaje: NO_DISPONIBLE };
  const r = await pagoPorPagar(d.data.pagoId);
  if (!r.ok) return { estado: "ERROR", mensaje: r.mensaje };

  try {
    const cobro = await getPasarela("culqi").cobrar({
      pagoId: r.pago.id,
      montoSoles: r.pago.monto,
      descripcion: r.descripcion,
      correo: estudiante.correo,
      token: d.data.token,
      huellaDispositivo: d.data.huella,
      autenticacion3DS: d.data.autenticacion3DS,
    });
    if (cobro.estado === "APROBADO") {
      const resultado = await confirmarPago(r.pago.id, { referencia: cobro.referencia, medio: cobro.medio, respuesta: cobro.respuesta, actor: estudiante.id });
      return { estado: "APROBADO", mensaje: MENSAJE_CONFIRMACION[resultado] };
    }
    if (cobro.estado === "REQUIERE_3DS") return { estado: "REQUIERE_3DS", mensaje: cobro.mensaje };

    // Rechazo: el estudiante ve el motivo y puede reintentar mientras dure la reserva.
    await createAdminClient()
      .from("pagos")
      .update({ observacion: cobro.mensaje, respuesta_pasarela: cobro.respuesta as Json })
      .eq("id", r.pago.id);
    await registrarActividad(estudiante.id, "PAGO_RECHAZADO", { inscripcion: r.ins.codigo, medio: cobro.medio, motivo: cobro.mensaje });
    return { estado: "RECHAZADO", mensaje: cobro.mensaje };
  } catch (e) {
    // Sin respuesta, Culqi pudo haber cobrado: el aviso del cargo confirmará el pago.
    if (e instanceof ErrorPasarela) return { estado: "ERROR", mensaje: SIN_RESPUESTA };
    throw e;
  }
}

/**
 * Tabla 12 · Si la pasarela falla, el estudiante cambia su pago pendiente al cobro directo
 * por Yape o Plin (validado por el administrador) sin perder la reserva.
 */
export async function cambiarAPagoDirecto(pagoId: string, metodo: "YAPE" | "PLIN"): Promise<{ ok: boolean; mensaje: string }> {
  const estudiante = await requireRol("estudiante");
  if (!pagoManualHabilitado()) return { ok: false, mensaje: "El pago directo por Yape o Plin no está disponible" };
  if (metodo !== "YAPE" && metodo !== "PLIN") return { ok: false, mensaje: "Elige Yape o Plin" };
  const r = await pagoPorPagar(pagoId);
  if (!r.ok) return r;
  const { error } = await createAdminClient()
    .from("pagos")
    .update({ metodo, medio: null, observacion: null })
    .eq("id", r.pago.id)
    .eq("estado", "PENDIENTE");
  if (error) return { ok: false, mensaje: error.message };
  await registrarActividad(estudiante.id, "CAMBIO_A_PAGO_DIRECTO", { inscripcion: r.ins.codigo, metodo });
  revalidatePath("/estudiante/pagos");
  return { ok: true, mensaje: `Listo: paga por ${metodo === "YAPE" ? "Yape" : "Plin"} y registra el N.º de operación.` };
}

/** Estado del pago propio, para la pantalla que espera la confirmación de la billetera. */
export async function estadoDelPago(pagoId: string): Promise<{ estado: EstadoPago | null; comprobanteId: number | null }> {
  await requireRol("estudiante");
  const supabase = await createClient();
  const { data } = await supabase.from("pagos").select("estado, comprobantes(id)").eq("id", pagoId).maybeSingle();
  return { estado: data?.estado ?? null, comprobanteId: uno<{ id: number }>(data?.comprobantes)?.id ?? null };
}
