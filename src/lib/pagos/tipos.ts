import type { MetodoPago } from "@/types/dominio";

export interface SolicitudCobro {
  pagoId: string;
  montoSoles: number;
  descripcion: string;
  correo: string;
  metodo: MetodoPago;
  /** Token generado en el navegador por el checkout de la pasarela. */
  tokenCliente?: string;
}

export interface ResultadoCobro {
  aprobado: boolean;
  referencia: string | null;
  mensaje: string;
  respuesta: unknown;
}

export interface EventoWebhook {
  referencia: string;
  estado: "APROBADO" | "RECHAZADO" | "REEMBOLSADO";
  respuesta: unknown;
}

/**
 * Contrato común de las pasarelas peruanas. Cambiar de proveedor
 * (PAYMENT_PROVIDER) no debe tocar el resto del sistema.
 */
export interface PasarelaPago {
  nombre: "culqi" | "izipay" | "niubiz";
  cobrar(solicitud: SolicitudCobro): Promise<ResultadoCobro>;
  reembolsar(referencia: string, montoSoles: number, motivo: string): Promise<ResultadoCobro>;
  /** Valida la firma del webhook y lo traduce a un evento del dominio. */
  procesarWebhook(cuerpo: string, headers: Headers): Promise<EventoWebhook | null>;
}
