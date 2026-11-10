import "server-only";
import { EMPRESA } from "@/config/empresa";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";
import { culqi } from "./culqi";
import { izipay } from "./izipay";
import { niubiz } from "./niubiz";
import type { PasarelaPago } from "./tipos";

const pasarelas: Record<PasarelaPago["nombre"], PasarelaPago> = { culqi, izipay, niubiz };

export function getPasarela(nombre = serverEnv.PAYMENT_PROVIDER): PasarelaPago {
  return pasarelas[nombre];
}

export function esPasarelaValida(nombre: string): nombre is PasarelaPago["nombre"] {
  return nombre in pasarelas;
}

/**
 * El pago en línea se ofrece solo con las dos llaves de Culqi y la clave del webhook (sin ella,
 * los pagos por billetera, banca móvil o agente nunca se confirmarían); si falta alguna, aparece
 * como «Próximamente».
 */
export function pasarelaActiva(): boolean {
  return Boolean(serverEnv.CULQI_SECRET_KEY && publicEnv.NEXT_PUBLIC_CULQI_PUBLIC_KEY && serverEnv.CULQI_WEBHOOK_SECRET);
}

/** Pago directo por Yape / Plin validado por el administrador (contingencia de la Tabla 12). */
export function pagoManualHabilitado(): boolean {
  return serverEnv.PAGO_MANUAL_HABILITADO && /^9\d{8}$/.test(EMPRESA.pagoDirecto.celular.replace(/\s/g, "")) && EMPRESA.pagoDirecto.titular.trim().length >= 3;
}

export { ErrorPasarela } from "./tipos";
export type {
  Autenticacion3DS,
  AvisoPasarela,
  ClientePasarela,
  ConsultaPasarela,
  PasarelaPago,
  ResultadoCobro,
  ResultadoReembolso,
  SolicitudCobro,
  SolicitudOrden,
} from "./tipos";
