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

/**
 * HU-37 · Enlaces de compartición en redes sociales con el enlace directo de verificación
 * del certificado digital emitido por PEDSAR E.I.R.L.
 */
export function enlacesCompartirCertificado(sitio: string, codigo: string, curso: string) {
  const verificacion = urlVerificacion(sitio, codigo);
  const urlCodificada = encodeURIComponent(verificacion);
  const textoWhatsapp = encodeURIComponent(
    `He obtenido mi certificado del curso «${curso}» en PEDSAR E.I.R.L. Verifícalo en: ${verificacion}`,
  );
  return {
    verificacion,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${urlCodificada}`,
    whatsapp: `https://wa.me/?text=${textoWhatsapp}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${urlCodificada}`,
  };
}
