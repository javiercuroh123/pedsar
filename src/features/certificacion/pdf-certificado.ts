import "server-only";
import { PDFDocument, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import { esCertificadoDeAprobacion } from "@/config/academico";
import { EMPRESA } from "@/config/empresa";
import { aWinAnsi, centrado, COLOR, dibujarIsotipo, partir, tamanoQueEntra } from "@/lib/pdf/comun";
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

const fechaLarga = (fecha: string) =>
  new Intl.DateTimeFormat("es-PE", { dateStyle: "long", timeZone: "America/Lima" }).format(
    /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? new Date(`${fecha}T12:00:00-05:00`) : new Date(fecha),
  );

/** QR de la URL de verificación, dibujado como un solo trazado vectorial. */
function dibujarQr(pagina: PDFPage, url: string, x: number, y: number, lado: number) {
  const { modulos, d } = trazadoQr(url);
  pagina.drawRectangle({ x: x - 5, y: y - 5, width: lado + 10, height: lado + 10, color: COLOR.blanco });
  // drawSvgPath ubica (x, y) en la esquina superior izquierda del trazado.
  pagina.drawSvgPath(d, { x, y: y + lado, scale: lado / modulos, color: COLOR.grafito });
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
