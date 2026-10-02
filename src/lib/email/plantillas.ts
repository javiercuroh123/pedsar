import { EMPRESA } from "@/config/empresa";

/**
 * Plantillas de correos transaccionales (HU-21). HTML con estilos en línea para que
 * se vea igual en Gmail, Outlook y apps móviles; colores del sistema de diseño
 * (grafito y cian). Todo texto variable pasa por `escapar`.
 */
const ENTIDADES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const escapar = (s: string) => s.replace(/[&<>"']/g, (c) => ENTIDADES[c]);

const COLOR = { grafito: "#18181b", texto: "#3f3f46", suave: "#71717a", borde: "#e4e4e7", cian: "#0e7490", ambar: "#fef3c7", ambarTexto: "#92400e" };

const marco = (contenido: string) => `
<div style="background:#f4f4f5;padding:24px 12px;font-family:Inter,Segoe UI,Arial,sans-serif;color:${COLOR.grafito}">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid ${COLOR.borde};border-radius:12px;overflow:hidden">
    <div style="background:${COLOR.grafito};padding:18px 28px">
      <span style="font-size:20px;font-weight:700;letter-spacing:0.5px;color:#ffffff">PEDSAR</span>
      <span style="font-size:12px;color:#a1a1aa;margin-left:8px">Cursos y capacitaciones</span>
    </div>
    <div style="padding:28px;font-size:15px;line-height:1.6;color:${COLOR.texto}">${contenido}</div>
  </div>
  <p style="max-width:560px;margin:16px auto 0;font-size:12px;line-height:1.5;color:${COLOR.suave};text-align:center">
    ${escapar(EMPRESA.razonSocial)} · RUC ${EMPRESA.ruc}<br />
    ${escapar(EMPRESA.direccion)} · ${escapar(EMPRESA.correo)}
  </p>
</div>`;

const saludo = (nombre: string) => `<p style="margin:0 0 12px">Hola ${escapar(nombre)},</p>`;

const boton = (texto: string, url: string) => `
<p style="margin:24px 0 8px">
  <a href="${escapar(encodeURI(url))}" style="display:inline-block;background:${COLOR.cian};color:#ffffff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:8px">${escapar(texto)}</a>
</p>`;

/** Tabla de datos clave (etiqueta → valor). Los valores ya deben venir escapados. */
const datos = (filas: [string, string][]) => `
<table role="presentation" style="width:100%;border-collapse:collapse;margin:16px 0;border-top:1px solid ${COLOR.borde}">
  ${filas
    .map(
      ([etiqueta, valor]) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid ${COLOR.borde};color:${COLOR.suave}">${escapar(etiqueta)}</td><td style="padding:8px 0;border-bottom:1px solid ${COLOR.borde};text-align:right;font-weight:600;color:${COLOR.grafito}">${valor}</td></tr>`,
    )
    .join("")}
</table>`;

const aviso = (contenido: string) =>
  `<p style="margin:16px 0;padding:12px 14px;border-radius:8px;background:${COLOR.ambar};color:${COLOR.ambarTexto}">${contenido}</p>`;

const pie = (texto: string) => `<p style="margin:16px 0 0;font-size:13px;color:${COLOR.suave}">${texto}</p>`;

// ---------- Matrícula y pagos ----------

/** Inscripción PENDIENTE con pago directo: instrucciones y plazo de la reserva. */
export function correoInscripcionRegistrada(p: {
  nombre: string;
  curso: string;
  codigo: string;
  monto: string;
  app: "Yape" | "Plin";
  celular: string;
  titular: string;
  venceEn: string;
  url: string;
}) {
  return {
    asunto: `Reservamos tu cupo en ${p.curso}`,
    html: marco(`
      ${saludo(p.nombre)}
      <p style="margin:0 0 12px">Registramos tu inscripción en <strong>${escapar(p.curso)}</strong> y tu cupo está reservado hasta el <strong>${escapar(p.venceEn)}</strong>.</p>
      <p style="margin:0">Para confirmar tu matrícula:</p>
      <ol style="margin:8px 0 0;padding-left:20px">
        <li>${p.app === "Yape" ? "Yapea" : "Envía por Plin"} <strong>${escapar(p.monto)}</strong> al <strong>${escapar(p.celular)}</strong> (${escapar(p.titular)}).</li>
        <li>Registra el <strong>N.º de operación</strong> en «Pagos» de tu cuenta.</li>
      </ol>
      ${datos([
        ["Inscripción", escapar(p.codigo)],
        ["Monto", escapar(p.monto)],
        ["Plazo para registrar el pago", escapar(p.venceEn)],
      ])}
      ${boton("Registrar mi pago", p.url)}
      ${pie("Si no registras el pago dentro del plazo, liberaremos el cupo para otro estudiante.")}`),
  };
}

/** Inscripción PENDIENTE con pago en línea: enlace para pagar y plazo de la reserva. */
export function correoInscripcionPorPagar(p: { nombre: string; curso: string; codigo: string; monto: string; venceEn: string; url: string }) {
  return {
    asunto: `Completa el pago de tu inscripción en ${p.curso}`,
    html: marco(`
      ${saludo(p.nombre)}
      <p style="margin:0 0 12px">Registramos tu inscripción en <strong>${escapar(p.curso)}</strong> y tu cupo está reservado hasta el <strong>${escapar(p.venceEn)}</strong>.</p>
      <p style="margin:0">Paga en línea con tarjeta, Yape, Plin u otra billetera y tu matrícula se confirmará al instante.</p>
      ${datos([
        ["Inscripción", escapar(p.codigo)],
        ["Monto", escapar(p.monto)],
        ["Plazo para pagar", escapar(p.venceEn)],
      ])}
      ${boton("Pagar ahora", p.url)}
      ${pie("Si no pagas dentro del plazo, liberaremos el cupo para otro estudiante.")}`),
  };
}

/** El administrador devolvió el pago para corregir el N.º de operación o la captura. */
export function correoPagoObservado(p: { nombre: string; curso: string; motivo: string; venceEn: string; url: string }) {
  return {
    asunto: `Revisa tu pago de ${p.curso}`,
    html: marco(`
      ${saludo(p.nombre)}
      <p style="margin:0">Revisamos el pago de tu inscripción en <strong>${escapar(p.curso)}</strong> y necesitamos que lo corrijas:</p>
      ${aviso(escapar(p.motivo))}
      <p style="margin:0">Tu cupo sigue reservado hasta el <strong>${escapar(p.venceEn)}</strong>.</p>
      ${boton("Corregir mi pago", p.url)}`),
  };
}

export function correoConfirmacionMatricula(p: { nombre: string; curso: string; codigo: string; url: string; comprobante?: { numero: string; url: string } }) {
  const filas: [string, string][] = [["Código de matrícula", escapar(p.codigo)]];
  if (p.comprobante) {
    filas.push(["Comprobante", `<a href="${escapar(encodeURI(p.comprobante.url))}" style="color:${COLOR.cian}">${escapar(p.comprobante.numero)}</a>`]);
  }
  return {
    asunto: `Matrícula confirmada: ${p.curso}`,
    html: marco(`
      ${saludo(p.nombre)}
      <p style="margin:0">Recibimos tu pago y tu matrícula en <strong>${escapar(p.curso)}</strong> está confirmada. Ya puedes ingresar al aula virtual.</p>
      ${datos(filas)}
      ${boton("Ir a mis cursos", p.url)}`),
  };
}

export function correoPagoRechazado(p: { nombre: string; curso: string; codigo: string; url: string }) {
  return {
    asunto: `No pudimos validar tu pago de ${p.curso}`,
    html: marco(`
      ${saludo(p.nombre)}
      <p style="margin:0">No pudimos validar el pago de tu inscripción <strong>${escapar(p.codigo)}</strong> en <strong>${escapar(p.curso)}</strong>, por lo que la cancelamos y liberamos el cupo.</p>
      <p style="margin:12px 0 0">Si crees que es un error, escríbenos a ${escapar(EMPRESA.correo)}. Si aún hay vacantes, puedes volver a inscribirte.</p>
      ${boton("Ver el curso", p.url)}`),
  };
}

// ---------- Comunidad ----------

/** HU-19 · Primer mensaje sin leer de una conversación (los siguientes solo van a la campana). */
export function correoMensajeNuevo(p: { nombre: string; de: string; curso: string; extracto: string; url: string }) {
  const extracto = p.extracto.length > 140 ? `${p.extracto.slice(0, 140)}…` : p.extracto;
  return {
    asunto: `Nuevo mensaje de ${p.de} · ${p.curso}`,
    html: marco(`
      ${saludo(p.nombre)}
      <p style="margin:0">${escapar(p.de)} te escribió sobre <strong>${escapar(p.curso)}</strong>:</p>
      ${aviso(escapar(extracto))}
      ${boton("Leer y responder", p.url)}
      ${pie("No te enviaremos otro correo por esta conversación hasta que leas este mensaje.")}`),
  };
}

// ---------- Certificación ----------

export function correoCertificadoEmitido(p: { nombre: string; curso: string; codigo: string; url: string }) {
  return {
    asunto: `Tu certificado de ${p.curso}`,
    html: marco(`
      <p style="margin:0 0 12px">¡Felicitaciones, ${escapar(p.nombre)}!</p>
      <p style="margin:0">Tu certificado de <strong>${escapar(p.curso)}</strong> ya está disponible en tu cuenta.</p>
      ${datos([["Código de verificación", escapar(p.codigo)]])}
      <p style="margin:0">Cualquier persona puede comprobar su autenticidad con ese código.</p>
      ${boton("Verificar certificado", p.url)}`),
  };
}
