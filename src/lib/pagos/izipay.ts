import "server-only";
import type { PasarelaPago } from "./tipos";

const pendiente = async (): Promise<never> => {
  throw new Error("Izipay: integración pendiente");
};

/** Izipay (tarjetas + Yape/Plin). Docs: https://developers.izipay.pe */
export const izipay: PasarelaPago = {
  nombre: "izipay",
  crearOrden: pendiente,
  cobrar: pendiente,
  consultar: pendiente,
  reembolsar: pendiente,
  leerWebhook: () => null,
};
