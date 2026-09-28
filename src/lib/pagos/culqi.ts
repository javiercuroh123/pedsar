import "server-only";
import { serverEnv } from "@/lib/env.server";
import type { PasarelaPago } from "./tipos";

const API = "https://api.culqi.com/v2";

function cabeceras() {
  if (!serverEnv.CULQI_SECRET_KEY) throw new Error("CULQI_SECRET_KEY no configurada");
  return {
    Authorization: `Bearer ${serverEnv.CULQI_SECRET_KEY}`,
    "Content-Type": "application/json",
  };
}

/** Culqi: tarjetas + Yape. Docs: https://docs.culqi.com */
export const culqi: PasarelaPago = {
  nombre: "culqi",

  async cobrar({ montoSoles, correo, descripcion, tokenCliente, pagoId }) {
    if (!tokenCliente) throw new Error("Falta el token de Culqi Checkout");

    const res = await fetch(`${API}/charges`, {
      method: "POST",
      headers: cabeceras(),
      body: JSON.stringify({
        amount: Math.round(montoSoles * 100), // céntimos
        currency_code: "PEN",
        email: correo,
        source_id: tokenCliente,
        description: descripcion.slice(0, 80),
        metadata: { pago_id: pagoId },
      }),
    });
    const json = await res.json();
    return {
      aprobado: res.ok && json?.outcome?.type === "venta_exitosa",
      referencia: json?.id ?? null,
      mensaje: json?.outcome?.user_message ?? json?.user_message ?? "Respuesta de Culqi",
      respuesta: json,
    };
  },

  async reembolsar(referencia, montoSoles, motivo) {
    const res = await fetch(`${API}/refunds`, {
      method: "POST",
      headers: cabeceras(),
      body: JSON.stringify({ amount: Math.round(montoSoles * 100), charge_id: referencia, reason: motivo }),
    });
    const json = await res.json();
    return { aprobado: res.ok, referencia: json?.id ?? null, mensaje: "Reembolso Culqi", respuesta: json };
  },

  async procesarWebhook(cuerpo) {
    // TODO: validar la autenticidad del webhook según la configuración del panel de Culqi
    // (credenciales básicas o firma) antes de pasar a producción.
    const evento = JSON.parse(cuerpo);
    const data = typeof evento?.data === "string" ? JSON.parse(evento.data) : evento?.data;
    if (!data?.id) return null;
    if (evento.type === "charge.succeeded") return { referencia: data.id, estado: "APROBADO", respuesta: evento };
    if (evento.type === "charge.failed") return { referencia: data.id, estado: "RECHAZADO", respuesta: evento };
    return null;
  },
};
