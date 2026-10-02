import type { Json } from "@/types/database";
import type { MedioPago } from "@/types/dominio";

export interface ClientePasarela {
  nombres: string;
  apellidos: string;
  correo: string;
  telefono: string | null;
}

/** Orden para pagar con billetera, banca móvil o agente; vence junto con la reserva. */
export interface SolicitudOrden {
  pagoId: string;
  montoSoles: number;
  descripcion: string;
  /** Único por orden (Culqi no acepta repetidos). */
  numeroOrden: string;
  cliente: ClientePasarela;
  venceEn: Date;
}

/** Parámetros que devuelve la verificación 3DS del banco (Culqi3DS). */
export interface Autenticacion3DS {
  eci: string;
  xid: string;
  cavv: string;
  protocolVersion: string;
  directoryServerTransactionId: string;
}

export interface SolicitudCobro {
  pagoId: string;
  montoSoles: number;
  descripcion: string;
  correo: string;
  /** Token generado en el navegador por el checkout (tarjeta o Yape). */
  token: string;
  huellaDispositivo?: string;
  autenticacion3DS?: Autenticacion3DS;
}

export interface ResultadoCobro {
  estado: "APROBADO" | "RECHAZADO" | "REQUIERE_3DS";
  referencia: string | null;
  medio: MedioPago | null;
  mensaje: string;
  respuesta: Json;
}

/** Lo único que se toma de un webhook: qué consultar. El estado se pregunta a la API. */
export interface AvisoPasarela {
  tipo: "orden" | "cargo";
  id: string;
}

export interface ConsultaPasarela {
  estado: "PAGADO" | "PENDIENTE" | "RECHAZADO" | "EXPIRADO";
  pagoId: string | null;
  montoCentimos: number;
  medio: MedioPago | null;
  referencia: string;
  respuesta: Json;
}

export interface ResultadoReembolso {
  aprobado: boolean;
  referencia: string | null;
  mensaje: string;
  respuesta: Json;
}

/** La pasarela no respondió (red, límite de tiempo o error del proveedor): se puede reintentar. */
export class ErrorPasarela extends Error {
  constructor(public detalle?: unknown) {
    super("No pudimos conectar con la pasarela de pagos");
    this.name = "ErrorPasarela";
  }
}

/**
 * Contrato común de las pasarelas peruanas. Cambiar de proveedor
 * (PAYMENT_PROVIDER) no debe tocar el resto del sistema.
 */
export interface PasarelaPago {
  nombre: "culqi" | "izipay" | "niubiz";
  crearOrden(solicitud: SolicitudOrden): Promise<{ id: string }>;
  cobrar(solicitud: SolicitudCobro): Promise<ResultadoCobro>;
  consultar(aviso: AvisoPasarela): Promise<ConsultaPasarela>;
  reembolsar(referencia: string, montoSoles: number, motivo: string): Promise<ResultadoReembolso>;
  leerWebhook(cuerpo: string): AvisoPasarela | null;
}
