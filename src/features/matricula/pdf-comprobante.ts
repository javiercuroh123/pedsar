import "server-only";
import { PDFDocument, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import { EMPRESA } from "@/config/empresa";
import { formatearFecha, formatearSoles } from "@/lib/formato";
import { aWinAnsi, COLOR, dibujarIsotipo, partir } from "@/lib/pdf/comun";

export interface DatosPdfComprobante {
  serie: string;
  numero: string;
  fechaEmision: string;
  /** Comprobante SUNAT que pidió el cliente (se emite por separado). */
  tipoSolicitado: "BOLETA" | "FACTURA";
  cliente: { nombre: string; documento: string | null; ruc: string | null; razonSocial: string | null };
  concepto: string;
  subtotal: number;
  descuento: number;
  total: number;
  /** Etiqueta del pago, p. ej. «Culqi · Tarjeta» (etiquetaPago). */
  pago: string;
  referencia: string | null;
}

const [ANCHO, ALTO] = [595.28, 841.89];
const MARGEN = 48;
const NOTA = "Documento interno de PEDSAR; no reemplaza la boleta o factura electrónica SUNAT.";

/**
 * HU-12 · HU-30 · Comprobante interno de pago en PDF (A4 vertical). Lo genera la ruta
 * /comprobantes/[id]/pdf con los datos congelados al aprobarse el pago.
 */
export async function generarPdfComprobante(d: DatosPdfComprobante): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const codigo = `${d.serie}-${d.numero}`;
  pdf.setTitle(aWinAnsi(`Comprobante de pago ${codigo}`));
  pdf.setAuthor(EMPRESA.razonSocial);
  pdf.setCreator("Sistema de gestión de cursos PEDSAR");
  pdf.setLanguage("es-PE");
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pagina = pdf.addPage([ANCHO, ALTO]);
  const util = ANCHO - 2 * MARGEN;

  const texto = (t: string, x: number, y: number, tam: number, fuente: PDFFont = normal, color = COLOR.texto) =>
    pagina.drawText(aWinAnsi(t), { x, y, size: tam, font: fuente, color });
  const derecha = (t: string, xFin: number, y: number, tam: number, fuente: PDFFont = normal, color = COLOR.texto) =>
    texto(t, xFin - fuente.widthOfTextAtSize(aWinAnsi(t), tam), y, tam, fuente, color);

  // ---------- Encabezado: empresa y número ----------
  let y = ALTO - MARGEN;
  dibujarIsotipo(pagina, MARGEN, y - 40, 40);
  texto("PEDSAR", MARGEN + 52, y - 16, 18, negrita, COLOR.grafito);
  texto("Cursos y capacitaciones", MARGEN + 52, y - 32, 9, normal, COLOR.suave);
  const cajaAncho = 190;
  const cajaX = ANCHO - MARGEN - cajaAncho;
  pagina.drawRectangle({ x: cajaX, y: y - 64, width: cajaAncho, height: 64, borderColor: COLOR.cian, borderWidth: 1.2, color: COLOR.cianClaro });
  centradoEn(pagina, "COMPROBANTE DE PAGO", cajaX + cajaAncho / 2, y - 20, negrita, 10, COLOR.cian);
  centradoEn(pagina, codigo, cajaX + cajaAncho / 2, y - 40, negrita, 15, COLOR.grafito);
  centradoEn(pagina, `Emitido el ${formatearFecha(d.fechaEmision)}`, cajaX + cajaAncho / 2, y - 55, normal, 8.5, COLOR.suave);

  y -= 84;
  for (const linea of [EMPRESA.razonSocial, `RUC ${EMPRESA.ruc}`, EMPRESA.direccion, `${EMPRESA.correo} · ${EMPRESA.telefono}`]) {
    for (const l of partir(linea, normal, 8.5, util)) {
      texto(l, MARGEN, y, 8.5, normal, COLOR.suave);
      y -= 12;
    }
  }

  // ---------- Cliente ----------
  y -= 14;
  pagina.drawLine({ start: { x: MARGEN, y }, end: { x: ANCHO - MARGEN, y }, thickness: 0.8, color: COLOR.borde });
  y -= 22;
  texto("CLIENTE", MARGEN, y, 9, negrita, COLOR.cian);
  y -= 18;
  const filasCliente: [string, string][] = d.cliente.ruc
    ? [
        ["Razón social", d.cliente.razonSocial ?? "—"],
        ["RUC del cliente", d.cliente.ruc],
        ["Estudiante", d.cliente.nombre],
      ]
    : [["Nombre", d.cliente.nombre], ...(d.cliente.documento ? [["Documento", d.cliente.documento] as [string, string]] : [])];
  filasCliente.push(["Comprobante SUNAT solicitado", `${d.tipoSolicitado === "FACTURA" ? "Factura" : "Boleta"} electrónica (se emite por separado)`]);
  for (const [etiqueta, valor] of filasCliente) {
    texto(etiqueta, MARGEN, y, 10, normal, COLOR.suave);
    texto(valor, MARGEN + 170, y, 10, negrita, COLOR.grafito);
    y -= 17;
  }

  // ---------- Detalle ----------
  y -= 16;
  pagina.drawRectangle({ x: MARGEN, y: y - 6, width: util, height: 22, color: COLOR.grafito });
  texto("Concepto", MARGEN + 10, y + 1, 9.5, negrita, COLOR.blanco);
  derecha("Importe", ANCHO - MARGEN - 10, y + 1, 9.5, negrita, COLOR.blanco);
  y -= 26;
  const lineasConcepto = partir(`Inscripción al curso «${d.concepto}»`, normal, 10, util - 140);
  for (const [i, l] of lineasConcepto.entries()) {
    texto(l, MARGEN + 10, y, 10, normal, COLOR.grafito);
    if (i === 0) derecha(formatearSoles(d.subtotal), ANCHO - MARGEN - 10, y, 10, normal, COLOR.grafito);
    y -= 14;
  }
  if (d.descuento > 0) {
    y -= 4;
    texto("Descuento por cupón", MARGEN + 10, y, 10, normal, COLOR.texto);
    derecha(`- ${formatearSoles(d.descuento)}`, ANCHO - MARGEN - 10, y, 10, normal, COLOR.texto);
    y -= 14;
  }
  y -= 6;
  pagina.drawLine({ start: { x: MARGEN, y: y + 6 }, end: { x: ANCHO - MARGEN, y: y + 6 }, thickness: 0.8, color: COLOR.borde });
  y -= 14;
  texto("Total pagado", MARGEN + 10, y, 12, negrita, COLOR.grafito);
  derecha(formatearSoles(d.total), ANCHO - MARGEN - 10, y, 12, negrita, COLOR.cian);

  // ---------- Pago ----------
  y -= 40;
  texto("PAGO", MARGEN, y, 9, negrita, COLOR.cian);
  y -= 18;
  texto("Medio de pago", MARGEN, y, 10, normal, COLOR.suave);
  texto(d.pago, MARGEN + 170, y, 10, negrita, COLOR.grafito);
  if (d.referencia) {
    y -= 17;
    texto("Referencia de la operación", MARGEN, y, 10, normal, COLOR.suave);
    texto(d.referencia, MARGEN + 170, y, 10, negrita, COLOR.grafito);
  }

  // ---------- Nota ----------
  const notaY = MARGEN + 30;
  pagina.drawRectangle({ x: MARGEN, y: notaY - 10, width: util, height: 30, color: COLOR.rosaClaro });
  centradoEn(pagina, NOTA, ANCHO / 2, notaY + 1, negrita, 9, COLOR.rojo);
  centradoEn(pagina, "Consérvalo como constancia de tu pago. Sistema de gestión de cursos PEDSAR.", ANCHO / 2, MARGEN, normal, 8, COLOR.suave);

  return pdf.save();
}

function centradoEn(pagina: PDFPage, t: string, cx: number, y: number, fuente: PDFFont, tam: number, color = COLOR.texto) {
  const limpio = aWinAnsi(t);
  pagina.drawText(limpio, { x: cx - fuente.widthOfTextAtSize(limpio, tam) / 2, y, size: tam, font: fuente, color });
}
