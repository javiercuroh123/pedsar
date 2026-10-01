import "server-only";
import { LineCapStyle, PDFDocument, StandardFonts, rgb, setCharacterSpacing, type PDFFont, type PDFPage } from "pdf-lib";
import { esCertificadoDeAprobacion } from "@/config/academico";
import { EMPRESA } from "@/config/empresa";
import { trazadoQr } from "./qr";

/** Datos congelados del certificado (tabla certificados) y la URL pública de verificación. */
export interface DatosPdfCertificado {
  estudiante: string;
  curso: string;
  duracion_horas: number;
  fecha_emision: string;
  codigo_unico: string;
  instructor: string | null;
  nota_final: number | null;
  urlVerificacion: string;
}

// A4 horizontal en puntos tipográficos.
const ANCHO = 841.89;
const ALTO = 595.28;

const hex = (h: string) => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
const COLOR = {
  grafito: hex("#18181b"),
  texto: hex("#3f3f46"),
  suave: hex("#71717a"),
  linea: hex("#a1a1aa"),
  cian: hex("#0e7490"),
  marca: hex("#0891b2"),
  cianClaro: hex("#ecfeff"),
  rosaClaro: hex("#fff1f2"),
  blanco: rgb(1, 1, 1),
};

/**
 * Las fuentes estándar del PDF usan WinAnsi (latín occidental: tildes, ñ, ¿¡, º). Un carácter
 * fuera de ese juego se reemplaza por su letra base («ș» → «s») para que nunca falle el PDF.
 */
const EXTRA_WINANSI = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");
const enWinAnsi = (c: string) => {
  const n = c.codePointAt(0)!;
  return (n >= 0x20 && n <= 0x7e) || (n >= 0xa0 && n <= 0xff) || EXTRA_WINANSI.has(c);
};
export const aWinAnsi = (texto: string) =>
  [...texto.normalize("NFC").replace(/\s+/g, " ")]
    .map((c) => (enWinAnsi(c) ? c : [...c.normalize("NFD").replace(/[̀-ͯ]/g, "")].filter(enWinAnsi).join("")))
    .join("")
    .trim();

const fechaLarga = (fecha: string) =>
  new Intl.DateTimeFormat("es-PE", { dateStyle: "long", timeZone: "America/Lima" }).format(
    /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? new Date(`${fecha}T12:00:00-05:00`) : new Date(fecha),
  );

/** Texto centrado en x; `espaciado` separa las letras (títulos en versalitas). */
function centrado(pagina: PDFPage, texto: string, y: number, fuente: PDFFont, tam: number, color = COLOR.texto, espaciado = 0, cx = ANCHO / 2) {
  const t = aWinAnsi(texto);
  const ancho = fuente.widthOfTextAtSize(t, tam) + espaciado * Math.max(t.length - 1, 0);
  if (espaciado) pagina.pushOperators(setCharacterSpacing(espaciado));
  pagina.drawText(t, { x: cx - ancho / 2, y, size: tam, font: fuente, color });
  if (espaciado) pagina.pushOperators(setCharacterSpacing(0));
}

/** Parte un texto en líneas que entren en `ancho`. */
function partir(texto: string, fuente: PDFFont, tam: number, ancho: number) {
  const lineas: string[] = [];
  let actual = "";
  for (const palabra of aWinAnsi(texto).split(" ")) {
    const prueba = actual ? `${actual} ${palabra}` : palabra;
    if (!actual || fuente.widthOfTextAtSize(prueba, tam) <= ancho) actual = prueba;
    else {
      lineas.push(actual);
      actual = palabra;
    }
  }
  if (actual) lineas.push(actual);
  return lineas;
}

/** Mayor tamaño (hasta `max`) con el que el texto entra en una línea de `ancho`. */
const tamanoQueEntra = (texto: string, fuente: PDFFont, max: number, min: number, ancho: number) => {
  let tam = max;
  while (tam > min && fuente.widthOfTextAtSize(aWinAnsi(texto), tam) > ancho) tam -= 1;
  return tam;
};

/** QR de la URL de verificación, dibujado como un solo trazado vectorial. */
function dibujarQr(pagina: PDFPage, url: string, x: number, y: number, lado: number) {
  const { modulos, d } = trazadoQr(url);
  pagina.drawRectangle({ x: x - 5, y: y - 5, width: lado + 10, height: lado + 10, color: COLOR.blanco });
  // drawSvgPath ubica (x, y) en la esquina superior izquierda del trazado.
  pagina.drawSvgPath(d, { x, y: y + lado, scale: lado / modulos, color: COLOR.grafito });
}

/** Isotipo de PEDSAR: birrete (ícono lucide) blanco sobre un cuadrado redondeado cian. */
function dibujarIsotipo(pagina: PDFPage, x: number, y: number, lado: number) {
  const r = lado * 0.24;
  pagina.drawSvgPath(
    `M${r} 0H${lado - r}Q${lado} 0 ${lado} ${r}V${lado - r}Q${lado} ${lado} ${lado - r} ${lado}H${r}Q0 ${lado} 0 ${lado - r}V${r}Q0 0 ${r} 0Z`,
    { x, y: y + lado, color: COLOR.marca },
  );
  const escala = (lado * 0.62) / 24;
  const desplazamiento = (lado - 24 * escala) / 2;
  for (const d of [
    "M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z",
    "M22 10v6",
    "M6 12.5V16a6 3 0 0 0 12 0v-3.5",
  ]) {
    // El grosor se expresa en unidades del ícono (24×24) y se escala junto con el trazado.
    pagina.drawSvgPath(d, {
      x: x + desplazamiento,
      y: y + lado - desplazamiento,
      scale: escala,
      borderColor: COLOR.blanco,
      borderWidth: 2.2,
      borderLineCap: LineCapStyle.Round,
    });
  }
}

/** Línea de firma con nombre y cargo. */
function firma(pagina: PDFPage, cx: number, y: number, nombre: string, cargo: string, fuentes: { normal: PDFFont; negrita: PDFFont }) {
  pagina.drawLine({ start: { x: cx - 95, y }, end: { x: cx + 95, y }, thickness: 0.8, color: COLOR.linea });
  centrado(pagina, nombre, y - 15, fuentes.negrita, tamanoQueEntra(nombre, fuentes.negrita, 10.5, 7, 200), COLOR.grafito, 0, cx);
  centrado(pagina, cargo, y - 28, fuentes.normal, 9, COLOR.suave, 0, cx);
}

/** HU-11 · Certificado digital en PDF (A4 horizontal) con código y QR de verificación pública. */
export async function generarPdfCertificado(d: DatosPdfCertificado): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const aprobacion = esCertificadoDeAprobacion(d.nota_final);
  pdf.setTitle(aWinAnsi(`Certificado ${d.codigo_unico} · ${d.curso}`));
  pdf.setAuthor(EMPRESA.razonSocial);
  pdf.setSubject(aWinAnsi(`Certificado de ${aprobacion ? "aprobación" : "participación"} de ${d.estudiante}`));
  pdf.setCreator("Sistema de gestión de cursos PEDSAR");
  pdf.setLanguage("es-PE");
  pdf.setCreationDate(new Date(`${d.fecha_emision}T12:00:00-05:00`));

  const pagina = pdf.addPage([ANCHO, ALTO]);
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold);
  const mono = await pdf.embedFont(StandardFonts.Courier);

  // Fondo y marcos (mismo diseño que la vista web del certificado)
  pagina.drawCircle({ x: 0, y: ALTO, size: 300, color: COLOR.cianClaro });
  pagina.drawCircle({ x: ANCHO, y: 0, size: 260, color: COLOR.rosaClaro });
  pagina.drawRectangle({ x: 22, y: 22, width: ANCHO - 44, height: ALTO - 44, borderColor: COLOR.cian, borderWidth: 2.5 });
  pagina.drawRectangle({ x: 31, y: 31, width: ANCHO - 62, height: ALTO - 62, borderColor: COLOR.cian, borderWidth: 0.6, borderOpacity: 0.35 });

  // Encabezado: isotipo + PEDSAR
  const anchoMarca = negrita.widthOfTextAtSize("PEDSAR", 20);
  const inicio = ANCHO / 2 - (28 + 10 + anchoMarca) / 2;
  dibujarIsotipo(pagina, inicio, ALTO - 104, 28);
  pagina.drawText("PEDSAR", { x: inicio + 38, y: ALTO - 97, size: 20, font: negrita, color: COLOR.grafito });

  // Título y beneficiario
  centrado(pagina, aprobacion ? "CERTIFICADO DE APROBACIÓN" : "CERTIFICADO DE PARTICIPACIÓN", ALTO - 150, negrita, 15, COLOR.cian, 3.5);
  centrado(pagina, "Otorgado a", ALTO - 190, normal, 12, COLOR.suave);
  centrado(pagina, d.estudiante, ALTO - 236, negrita, tamanoQueEntra(d.estudiante, negrita, 36, 18, ANCHO - 200), COLOR.grafito);
  pagina.drawLine({ start: { x: ANCHO / 2 - 60, y: ALTO - 252 }, end: { x: ANCHO / 2 + 60, y: ALTO - 252 }, thickness: 1.2, color: COLOR.marca });

  // Curso, duración, nota y fecha
  let y = ALTO - 284;
  centrado(pagina, aprobacion ? "por haber aprobado el curso" : "por haber participado en el curso", y, normal, 12.5);
  y -= 26;
  const lineasCurso = partir(d.curso, negrita, 18, ANCHO - 240);
  if (lineasCurso.length > 2) lineasCurso.splice(1, Infinity, `${lineasCurso.slice(1).join(" ").slice(0, 60).trimEnd()}…`);
  for (const linea of lineasCurso) {
    centrado(pagina, linea, y, negrita, 18, COLOR.grafito);
    y -= 23;
  }
  const detalle = `con una duración de ${d.duracion_horas} horas académicas${aprobacion ? ` y una nota final de ${d.nota_final!.toFixed(1)} sobre 20` : ""}.`;
  centrado(pagina, detalle, y - 2, normal, 12.5);
  centrado(pagina, `Ica, ${fechaLarga(d.fecha_emision)}.`, y - 22, normal, 12.5, COLOR.suave);

  // Firmas y QR
  const fuentes = { normal, negrita };
  firma(pagina, 190, 132, "Gerencia General", "PEDSAR E.I.R.L.", fuentes);
  firma(pagina, ANCHO - 190, 132, d.instructor || "Coordinación académica", d.instructor ? "Instructor(a)" : "PEDSAR E.I.R.L.", fuentes);
  dibujarQr(pagina, d.urlVerificacion, ANCHO / 2 - 37, 92, 74);
  centrado(pagina, d.codigo_unico, 76, mono, 10, COLOR.grafito);

  centrado(
    pagina,
    `Verifica la autenticidad de este certificado escaneando el QR o en ${d.urlVerificacion.replace(/\?.*$/, "")} con el código ${d.codigo_unico}.`,
    50,
    normal,
    8,
    COLOR.suave,
  );
  centrado(pagina, `${EMPRESA.razonSocial} · RUC ${EMPRESA.ruc}`, 39, normal, 7, COLOR.linea);

  return pdf.save();
}
