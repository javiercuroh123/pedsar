import "server-only";
import { serverEnv } from "@/lib/env.server";
import type { Json } from "@/types/database";
import type { MedioPago } from "@/types/dominio";
import { ErrorPasarela, type ConsultaPasarela, type PasarelaPago } from "./tipos";

const API = "https://api.culqi.com/v2";
const LIMITE_MS = 15_000;

const centimos = (soles: number) => Math.round(soles * 100);

/** Llama a la API de Culqi. Sin respuesta, con límite de tiempo o con error 5xx lanza ErrorPasarela. */
async function llamar(ruta: string, cuerpo?: object) {
  if (!serverEnv.CULQI_SECRET_KEY) throw new Error("CULQI_SECRET_KEY no configurada");
  let res: Response;
  try {
    res = await fetch(`${API}${ruta}`, {
      method: cuerpo ? "POST" : "GET",
      headers: { Authorization: `Bearer ${serverEnv.CULQI_SECRET_KEY}`, "Content-Type": "application/json" },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
      signal: AbortSignal.timeout(LIMITE_MS),
    });
  } catch (e) {
    throw new ErrorPasarela(e);
  }
  const json = await res.json().catch(() => null);
  if (res.status >= 500) throw new ErrorPasarela(json);
  return { ok: res.ok, json };
}

/** Los tokens de Yape empiezan con «ype_»; los de tarjeta, con «tkn_». */
const medioDelToken = (id: unknown): MedioPago => (typeof id === "string" && id.startsWith("ype_") ? "YAPE" : "TARJETA");

const mensajeDe = (json: { user_message?: string; merchant_message?: string; outcome?: { user_message?: string } } | null, porDefecto: string) =>
  json?.outcome?.user_message ?? json?.user_message ?? json?.merchant_message ?? porDefecto;

const ESTADO_ORDEN: Record<string, ConsultaPasarela["estado"]> = { paid: "PAGADO", pending: "PENDIENTE", expired: "EXPIRADO", deleted: "EXPIRADO" };

/** Culqi: tarjetas y Yape (token → cargo) y billeteras, banca móvil y agentes (orden). Docs: https://docs.culqi.com */
export const culqi: PasarelaPago = {
  nombre: "culqi",

  async crearOrden({ pagoId, montoSoles, descripcion, numeroOrden, cliente, venceEn }) {
    const { ok, json } = await llamar("/orders", {
      amount: centimos(montoSoles),
      currency_code: "PEN",
      description: descripcion.slice(0, 80),
      order_number: numeroOrden,
      expiration_date: Math.floor(venceEn.getTime() / 1000),
      client_details: { first_name: cliente.nombres, last_name: cliente.apellidos, email: cliente.correo, phone_number: cliente.telefono ?? "" },
      // El checkout confirma la orden cuando el cliente elige billetera, banca móvil o agente.
      confirm: false,
      metadata: { pago_id: pagoId },
    });
    if (!ok || !json?.id) throw new ErrorPasarela(json);
    return { id: json.id as string };
  },

  async cobrar({ pagoId, montoSoles, descripcion, correo, token, huellaDispositivo, autenticacion3DS }) {
    const { ok, json } = await llamar("/charges", {
      amount: centimos(montoSoles),
      currency_code: "PEN",
      email: correo,
      source_id: token,
      description: descripcion.slice(0, 80),
      metadata: { pago_id: pagoId },
      ...(huellaDispositivo ? { antifraud_details: { device_finger_print_id: huellaDispositivo } } : {}),
      ...(autenticacion3DS ? { authentication_3DS: autenticacion3DS } : {}),
    });
    const medio = medioDelToken(token);
    if (json?.action_code === "REVIEW") {
      return { estado: "REQUIERE_3DS", referencia: null, medio, mensaje: mensajeDe(json, "Tu banco pide verificar la compra"), respuesta: json };
    }
    const aprobado = ok && json?.outcome?.type === "venta_exitosa";
    return {
      estado: aprobado ? "APROBADO" : "RECHAZADO",
      referencia: aprobado ? (json.id as string) : null,
      medio,
      mensaje: mensajeDe(json, aprobado ? "Pago aprobado" : "El pago fue rechazado"),
      respuesta: json as Json,
    };
  },

  async consultar({ tipo, id }) {
    const { ok, json } = await llamar(`/${tipo === "orden" ? "orders" : "charges"}/${encodeURIComponent(id)}`);
    if (!ok || !json) throw new ErrorPasarela(json);
    const comun = { pagoId: (json.metadata?.pago_id as string | undefined) ?? null, montoCentimos: Number(json.amount ?? 0), referencia: id, respuesta: json as Json };
    if (tipo === "orden") return { ...comun, estado: ESTADO_ORDEN[json.state] ?? "PENDIENTE", medio: "BILLETERA" };
    return { ...comun, estado: json.outcome?.type === "venta_exitosa" ? "PAGADO" : "RECHAZADO", medio: medioDelToken(json.source?.id) };
  },

  async reembolsar(referencia, montoSoles, motivo) {
    const { ok, json } = await llamar("/refunds", { amount: centimos(montoSoles), charge_id: referencia, reason: motivo });
    return { aprobado: ok, referencia: ok ? (json?.id ?? null) : null, mensaje: mensajeDe(json, ok ? "Reembolso registrado en Culqi" : "Culqi rechazó el reembolso"), respuesta: json };
  },

  leerWebhook(cuerpo) {
    try {
      const evento = JSON.parse(cuerpo);
      const data = typeof evento?.data === "string" ? JSON.parse(evento.data) : evento?.data;
      if (typeof data?.id !== "string") return null;
      if (evento.type === "order.status.changed") return { tipo: "orden", id: data.id };
      if (evento.type === "charge.creation.succeeded") return { tipo: "cargo", id: data.id };
      return null;
    } catch {
      return null;
    }
  },
};
