"use server";

import { z } from "zod";
import { reservaVencida } from "@/config/matricula";
import { uno } from "@/features/academico/consultas";
import { confirmarPago } from "@/features/matricula/confirmar-pago";
import { registrarActividad } from "@/lib/auditoria";
import { requireRol } from "@/lib/auth";
import { publicEnv } from "@/lib/env";
import { ErrorPasarela, getPasarela, pasarelaActiva, type Autenticacion3DS } from "@/lib/pagos";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";
import type { EstadoPago } from "@/types/dominio";

/** Lo que necesita el Checkout Custom de Culqi en el navegador. */
export interface DatosCheckout {
  llavePublica: string;
  montoCentimos: number;
  ordenId: string;
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
export async function prepararPagoEnLinea(pagoId: string): Promise<{ ok: true; checkout: DatosCheckout } | { ok: false; mensaje: string }> {
  const estudiante = await requireRol("estudiante");
  if (!pasarelaActiva()) return { ok: false, mensaje: NO_DISPONIBLE };
  const r = await pagoPorPagar(pagoId);
  if (!r.ok) return r;

  const pasarela = getPasarela("culqi");
  try {
    let ordenId = r.pago.orden;
    if (ordenId) {
      const anterior = await pasarela.consultar({ tipo: "orden", id: ordenId });
      if (anterior.estado === "PAGADO") return { ok: false, mensaje: "Ya recibimos tu pago; en unos segundos se confirmará tu matrícula" };
      if (anterior.estado !== "PENDIENTE") ordenId = null;
    }
    if (!ordenId) {
      const venceEn = r.ins.vence_en ? new Date(r.ins.vence_en) : new Date(Date.now() + 48 * 3600 * 1000);
      const orden = await pasarela.crearOrden({
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
      ordenId = orden.id;
      await createAdminClient().from("pagos").update({ orden_pasarela: ordenId }).eq("id", r.pago.id);
    }
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
      await confirmarPago(r.pago.id, { referencia: cobro.referencia, medio: cobro.medio, respuesta: cobro.respuesta, actor: estudiante.id });
      return { estado: "APROBADO", mensaje: "¡Pago aprobado! Tu matrícula está confirmada." };
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
    if (e instanceof ErrorPasarela) return { estado: "ERROR", mensaje: e.message };
    throw e;
  }
}

/** Estado del pago propio, para la pantalla que espera la confirmación de la billetera. */
export async function estadoDelPago(pagoId: string): Promise<{ estado: EstadoPago | null; comprobanteId: number | null }> {
  await requireRol("estudiante");
  const supabase = await createClient();
  const { data } = await supabase.from("pagos").select("estado, comprobantes(id)").eq("id", pagoId).maybeSingle();
  return { estado: data?.estado ?? null, comprobanteId: uno<{ id: number }>(data?.comprobantes)?.id ?? null };
}
