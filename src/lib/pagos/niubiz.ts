import "server-only";
import type { PasarelaPago } from "./tipos";

/** Niubiz (VisaNet). Docs: https://desarrolladores.niubiz.com.pe */
export const niubiz: PasarelaPago = {
  nombre: "niubiz",
  async cobrar() {
    throw new Error("Niubiz: integración pendiente (Sprint 2)");
  },
  async reembolsar() {
    throw new Error("Niubiz: integración pendiente");
  },
  async procesarWebhook() {
    return null;
  },
};
