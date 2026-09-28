import "server-only";
import { randomBytes } from "node:crypto";

/** Código único verificable, p. ej. PED-2026-7K3QX9M2 (sin caracteres ambiguos). */
export function generarCodigoCertificado(fecha = new Date()): string {
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 32 símbolos: sin sesgo con b % 32
  const sufijo = Array.from(randomBytes(8), (b) => alfabeto[b % alfabeto.length]).join("");
  return `PED-${fecha.getFullYear()}-${sufijo}`;
}
