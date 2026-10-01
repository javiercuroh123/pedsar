import "server-only";
import { PDFDocument, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import { EMPRESA } from "@/config/empresa";
import { aWinAnsi, COLOR, dibujarIsotipo, partir, recortar } from "./comun";

/** Columna de una tabla del reporte; `ancho` es relativo (se reparte el ancho útil de la página). */
export interface ColumnaPdf {
  titulo: string;
  ancho: number;
  alinear?: "izquierda" | "derecha" | "centro";
}

export interface SeccionPdf {
  titulo: string;
  columnas: ColumnaPdf[];
  filas: string[][];
  totales?: string[];
  /** Texto si la tabla no tiene filas. */
  vacio?: string;
}

export interface DatosPdfReporte {
  titulo: string;
  subtitulo: string;
  resumen: { etiqueta: string; valor: string; detalle?: string }[];
  secciones: SeccionPdf[];
  horizontal?: boolean;
  /** Aclaración al final (p. ej. cómo se calcula un indicador). */
  nota?: string;
}

const MARGEN = 36;
const PIE = 40;
const TAM = 8.5;
const LINEA = 10.5;

interface Fuentes {
  normal: PDFFont;
  negrita: PDFFont;
}

/**
 * RF-10 / HU-42 · Reporte tabular en PDF (A4): encabezado con la marca, resumen de
 * indicadores y tablas que continúan en páginas nuevas repitiendo su cabecera; al pie,
 * fecha de generación y «Página X de Y».
 */
export async function generarPdfReporte(d: DatosPdfReporte): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(aWinAnsi(`${d.titulo} · ${d.subtitulo}`));
  pdf.setAuthor(EMPRESA.razonSocial);
  pdf.setCreator("Sistema de gestión de cursos PEDSAR");
  pdf.setLanguage("es-PE");
  const f: Fuentes = { normal: await pdf.embedFont(StandardFonts.Helvetica), negrita: await pdf.embedFont(StandardFonts.HelveticaBold) };
  const [ancho, alto] = d.horizontal ? [841.89, 595.28] : [595.28, 841.89];
  const util = ancho - 2 * MARGEN;

  let pagina!: PDFPage;
  let y = 0;
  const nuevaPagina = () => {
    pagina = pdf.addPage([ancho, alto]);
    dibujarIsotipo(pagina, MARGEN, alto - MARGEN - 22, 22);
    pagina.drawText("PEDSAR", { x: MARGEN + 29, y: alto - MARGEN - 16, size: 13, font: f.negrita, color: COLOR.grafito });
    const titulo = aWinAnsi(d.titulo);
    const subtitulo = recortar(d.subtitulo, f.normal, 9, util - 160);
    pagina.drawText(titulo, { x: ancho - MARGEN - f.negrita.widthOfTextAtSize(titulo, 13), y: alto - MARGEN - 10, size: 13, font: f.negrita, color: COLOR.grafito });
    pagina.drawText(subtitulo, { x: ancho - MARGEN - f.normal.widthOfTextAtSize(subtitulo, 9), y: alto - MARGEN - 23, size: 9, font: f.normal, color: COLOR.suave });
    pagina.drawLine({ start: { x: MARGEN, y: alto - MARGEN - 32 }, end: { x: ancho - MARGEN, y: alto - MARGEN - 32 }, thickness: 1.2, color: COLOR.marca });
    y = alto - MARGEN - 52;
  };
  /** Asegura `alto` puntos libres antes del pie; si no, salta de página y devuelve true. */
  const reservar = (necesario: number) => {
    if (y - necesario >= PIE + 8) return false;
    nuevaPagina();
    return true;
  };

  nuevaPagina();

  // Resumen de indicadores en tarjetas
  if (d.resumen.length) {
    const porFila = Math.min(d.resumen.length, d.horizontal ? 5 : 4);
    const sep = 8;
    const anchoTarjeta = (util - sep * (porFila - 1)) / porFila;
    const altoTarjeta = d.resumen.some((r) => r.detalle) ? 50 : 40;
    d.resumen.forEach((r, i) => {
      if (i % porFila === 0) {
        if (i) y -= altoTarjeta + sep;
        reservar(altoTarjeta);
      }
      const x = MARGEN + (i % porFila) * (anchoTarjeta + sep);
      pagina.drawRectangle({ x, y: y - altoTarjeta, width: anchoTarjeta, height: altoTarjeta, borderColor: COLOR.borde, borderWidth: 0.8, color: COLOR.blanco });
      pagina.drawText(recortar(r.etiqueta, f.normal, 8, anchoTarjeta - 16), { x: x + 8, y: y - 14, size: 8, font: f.normal, color: COLOR.suave });
      pagina.drawText(recortar(r.valor, f.negrita, 14, anchoTarjeta - 16), { x: x + 8, y: y - 31, size: 14, font: f.negrita, color: COLOR.grafito });
      if (r.detalle) pagina.drawText(recortar(r.detalle, f.normal, 7.5, anchoTarjeta - 16), { x: x + 8, y: y - 43, size: 7.5, font: f.normal, color: COLOR.suave });
    });
    y -= altoTarjeta + 20;
  }

  for (const s of d.secciones) dibujarSeccion(s);

  if (d.nota) {
    const lineas = partir(d.nota, f.normal, 7.5, util);
    reservar(lineas.length * 10 + 4);
    lineas.forEach((l) => {
      pagina.drawText(l, { x: MARGEN, y, size: 7.5, font: f.normal, color: COLOR.suave });
      y -= 10;
    });
  }

  // Pie en todas las páginas (el total se conoce al final)
  const generado = new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Lima" }).format(new Date());
  const paginas = pdf.getPages();
  paginas.forEach((p, i) => {
    p.drawLine({ start: { x: MARGEN, y: PIE - 6 }, end: { x: ancho - MARGEN, y: PIE - 6 }, thickness: 0.5, color: COLOR.borde });
    const izquierda = aWinAnsi(`Generado el ${generado} · ${EMPRESA.razonSocial} · RUC ${EMPRESA.ruc}`);
    p.drawText(recortar(izquierda, f.normal, 7, util - 80), { x: MARGEN, y: PIE - 18, size: 7, font: f.normal, color: COLOR.suave });
    const num = `Página ${i + 1} de ${paginas.length}`;
    p.drawText(aWinAnsi(num), { x: ancho - MARGEN - f.normal.widthOfTextAtSize(aWinAnsi(num), 7), y: PIE - 18, size: 7, font: f.normal, color: COLOR.suave });
  });

  return pdf.save();

  function dibujarSeccion(s: SeccionPdf) {
    const total = s.columnas.reduce((a, c) => a + c.ancho, 0);
    const anchos = s.columnas.map((c) => (c.ancho / total) * util);
    const xs = anchos.map((_, i) => MARGEN + anchos.slice(0, i).reduce((a, b) => a + b, 0));

    const tituloSeccion = (continuacion: boolean) => {
      pagina.drawText(aWinAnsi(continuacion ? `${s.titulo} (continuación)` : s.titulo), { x: MARGEN, y, size: 10.5, font: f.negrita, color: COLOR.grafito });
      y -= 12;
    };
    const cabecera = () => {
      pagina.drawRectangle({ x: MARGEN, y: y - 18, width: util, height: 18, color: COLOR.cianClaro });
      s.columnas.forEach((c, i) => celda(c.titulo, i, y - 12.5, f.negrita, COLOR.cian));
      y -= 18;
    };
    const celda = (texto: string, i: number, base: number, fuente: PDFFont, color = COLOR.texto) => {
      const t = recortar(texto, fuente, TAM, anchos[i] - 8);
      const w = fuente.widthOfTextAtSize(t, TAM);
      const a = s.columnas[i].alinear ?? "izquierda";
      const x = a === "derecha" ? xs[i] + anchos[i] - 4 - w : a === "centro" ? xs[i] + (anchos[i] - w) / 2 : xs[i] + 4;
      pagina.drawText(t, { x, y: base, size: TAM, font: fuente, color });
    };

    // Título + cabecera + al menos una fila deben ir juntos en la misma página.
    reservar(12 + 18 + 22);
    tituloSeccion(false);
    cabecera();

    if (!s.filas.length) {
      pagina.drawText(aWinAnsi(s.vacio ?? "Sin datos en el periodo."), { x: MARGEN + 4, y: y - 14, size: TAM, font: f.normal, color: COLOR.suave });
      y -= 30;
      return;
    }

    s.filas.forEach((fila, n) => {
      // La primera columna puede ocupar hasta dos líneas; las demás se recortan.
      const lineas = partir(fila[0] ?? "", f.normal, TAM, anchos[0] - 8).slice(0, 2);
      if (partir(fila[0] ?? "", f.normal, TAM, anchos[0] - 8).length > 2) lineas[1] = recortar(`${lineas[1]} …`, f.normal, TAM, anchos[0] - 8);
      const altoFila = Math.max(1, lineas.length) * LINEA + 7;
      if (reservar(altoFila)) {
        tituloSeccion(true);
        cabecera();
      }
      if (n % 2 === 1) pagina.drawRectangle({ x: MARGEN, y: y - altoFila, width: util, height: altoFila, color: COLOR.zebra });
      lineas.forEach((l, k) => pagina.drawText(l, { x: xs[0] + 4, y: y - 11 - k * LINEA, size: TAM, font: f.normal, color: COLOR.grafito }));
      fila.slice(1).forEach((v, i) => celda(v, i + 1, y - 11, f.normal));
      pagina.drawLine({ start: { x: MARGEN, y: y - altoFila }, end: { x: MARGEN + util, y: y - altoFila }, thickness: 0.4, color: COLOR.borde });
      y -= altoFila;
    });

    if (s.totales) {
      if (reservar(20)) {
        tituloSeccion(true);
        cabecera();
      }
      pagina.drawLine({ start: { x: MARGEN, y }, end: { x: MARGEN + util, y }, thickness: 1, color: COLOR.grafito });
      s.totales.forEach((v, i) => celda(v, i, y - 12, f.negrita, COLOR.grafito));
      y -= 20;
    }
    y -= 16;
  }
}
