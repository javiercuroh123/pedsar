import "server-only";
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

export type { PasarelaPago, SolicitudCobro, ResultadoCobro, EventoWebhook } from "./tipos";
