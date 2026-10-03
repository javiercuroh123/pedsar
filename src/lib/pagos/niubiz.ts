import "server-only";
import type { PasarelaPago } from "./tipos";

const pendiente = async (): Promise<never> => {
  throw new Error("Niubiz: integración pendiente");
};

/** Niubiz (VisaNet). Docs: https://desarrolladores.niubiz.com.pe */
export const niubiz: PasarelaPago = {
  nombre: "niubiz",
  crearOrden: pendiente,
  cobrar: pendiente,
  consultar: pendiente,
  reembolsar: pendiente,
  leerWebhook: () => null,
};
