import "server-only";
import { LineCapStyle, rgb, setCharacterSpacing, type PDFFont, type PDFPage } from "pdf-lib";

/** Piezas compartidas por los PDF del sistema (certificados y reportes), con la paleta grafito y cian. */
const hex = (h: string) => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);

export const COLOR = {
  grafito: hex("#18181b"),
  texto: hex("#3f3f46"),
  suave: hex("#71717a"),
  linea: hex("#a1a1aa"),
  borde: hex("#e4e4e7"),
  zebra: hex("#fafafa"),
  cian: hex("#0e7490"),
  marca: hex("#0891b2"),
  cianClaro: hex("#ecfeff"),
  rosaClaro: hex("#fff1f2"),
  rojo: hex("#b91c1c"),
  blanco: rgb(1, 1, 1),
};

/**
 * Las fuentes estándar del PDF usan WinAnsi (latín occidental: tildes, ñ, ¿¡, º). Un carácter
 * fuera de ese juego se reemplaza por su letra base («ș» → «s») para que nunca falle el PDF.
 */
const EXTRA_WINANSI = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");
/** Símbolos frecuentes sin equivalente en WinAnsi. */
const EQUIVALENTES: Record<string, string> = { "≥": ">=", "≤": "<=", "≠": "!=", "→": "->", "←": "<-", "✓": "v", "✔": "v", "−": "-" };
const enWinAnsi = (c: string) => {
  const n = c.codePointAt(0)!;
  return (n >= 0x20 && n <= 0x7e) || (n >= 0xa0 && n <= 0xff) || EXTRA_WINANSI.has(c);
};
export const aWinAnsi = (texto: string) =>
  [...texto.normalize("NFC").replace(/\s+/g, " ")]
    .map((c) =>
      enWinAnsi(c) ? c : (EQUIVALENTES[c] ?? [...c.normalize("NFD").replace(/[̀-ͯ]/g, "")].filter(enWinAnsi).join("")),
    )
    .join("")
    .trim();

/** Texto centrado en `cx`; `espaciado` separa las letras (títulos en versalitas). */
export function centrado(
  pagina: PDFPage,
  texto: string,
  y: number,
  fuente: PDFFont,
  tam: number,
  color = COLOR.texto,
  espaciado = 0,
  cx = pagina.getWidth() / 2,
) {
  const t = aWinAnsi(texto);
  const ancho = fuente.widthOfTextAtSize(t, tam) + espaciado * Math.max(t.length - 1, 0);
  if (espaciado) pagina.pushOperators(setCharacterSpacing(espaciado));
  pagina.drawText(t, { x: cx - ancho / 2, y, size: tam, font: fuente, color });
  if (espaciado) pagina.pushOperators(setCharacterSpacing(0));
}

/** Parte un texto en líneas que entren en `ancho`. */
export function partir(texto: string, fuente: PDFFont, tam: number, ancho: number) {
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

/** Recorta el texto con «…» para que entre en `ancho`. */
export function recortar(texto: string, fuente: PDFFont, tam: number, ancho: number) {
  let t = aWinAnsi(texto);
  if (fuente.widthOfTextAtSize(t, tam) <= ancho) return t;
  while (t && fuente.widthOfTextAtSize(`${t}…`, tam) > ancho) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

/** Mayor tamaño (hasta `max`) con el que el texto entra en una línea de `ancho`. */
export const tamanoQueEntra = (texto: string, fuente: PDFFont, max: number, min: number, ancho: number) => {
  let tam = max;
  while (tam > min && fuente.widthOfTextAtSize(aWinAnsi(texto), tam) > ancho) tam -= 1;
  return tam;
};

/** Isotipo de PEDSAR: birrete (ícono lucide) blanco sobre un cuadrado redondeado cian. (x, y) = esquina inferior izquierda. */
export function dibujarIsotipo(pagina: PDFPage, x: number, y: number, lado: number) {
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
