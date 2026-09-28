import "server-only";
import type { PasarelaPago } from "./tipos";

/** Izipay (tarjetas + Yape/Plin). Docs: https://developers.izipay.pe */
export const izipay: PasarelaPago = {
  nombre: "izipay",
  async cobrar() {
    throw new Error("Izipay: integración pendiente (Sprint 2)");
  },
  async reembolsar() {
    throw new Error("Izipay: integración pendiente");
  },
  async procesarWebhook() {
    return null;
  },
};
