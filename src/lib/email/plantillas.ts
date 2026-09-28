const ENTIDADES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const escapar = (s: string) => s.replace(/[&<>"']/g, (c) => ENTIDADES[c]);

const marco = (contenido: string) => `
  <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#18181b">
    <h2 style="color:#2a3fe0">PEDSAR</h2>
    ${contenido}
    <p style="color:#71717a;font-size:12px;margin-top:32px">PEDSAR E.I.R.L. · Ayacucho, Perú</p>
  </div>`;

export function correoConfirmacionMatricula(p: { nombre: string; curso: string; codigo: string }) {
  return {
    asunto: `Matrícula confirmada: ${p.curso}`,
    html: marco(`
      <p>Hola ${escapar(p.nombre)},</p>
      <p>Tu matrícula en <strong>${escapar(p.curso)}</strong> fue confirmada.</p>
      <p>Código de matrícula: <strong>${escapar(p.codigo)}</strong></p>`),
  };
}

export function correoCertificadoEmitido(p: { nombre: string; curso: string; codigo: string; url: string }) {
  return {
    asunto: `Tu certificado de ${p.curso}`,
    html: marco(`
      <p>Felicitaciones ${escapar(p.nombre)},</p>
      <p>Tu certificado de <strong>${escapar(p.curso)}</strong> ya está disponible.</p>
      <p>Código de verificación: <strong>${escapar(p.codigo)}</strong><br/>
      <a href="${encodeURI(p.url)}">Verificar certificado</a></p>`),
  };
}
