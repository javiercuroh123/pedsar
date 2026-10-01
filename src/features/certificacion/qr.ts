import { encode } from "uqr";

/**
 * QR de un texto como un único trazado SVG en unidades de módulo (un cuadrado de 1×1
 * por módulo oscuro, sin margen). Lo usan la vista web y el PDF del certificado.
 */
export function trazadoQr(texto: string) {
  const qr = encode(texto, { ecc: "M", border: 0 });
  let d = "";
  qr.data.forEach((fila, r) => fila.forEach((oscuro, c) => oscuro && (d += `M${c} ${r}h1v1h-1z`)));
  return { modulos: qr.size, d };
}

export const urlVerificacion = (sitio: string, codigo: string) => `${sitio}/verificar?codigo=${codigo}`;
