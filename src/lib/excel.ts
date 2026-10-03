import "server-only";
import writeXlsxFile, { type Cell, type Row, type Sheet } from "write-excel-file/node";

/** Formato de una columna: define el tipo de celda y el formato numérico de Excel. */
export type FormatoExcel = "texto" | "entero" | "decimal" | "nota" | "soles" | "porcentaje" | "asistencia" | "fecha";

export interface ColumnaExcel {
  titulo: string;
  /** Ancho en caracteres. */
  ancho: number;
  formato?: FormatoExcel;
}

/** Valor de una celda; `{ valor, formato }` permite un formato distinto al de su columna. */
export type ValorExcel = string | number | Date | null | { valor: number; formato: FormatoExcel };

const FORMATO_NUMERICO: Partial<Record<FormatoExcel, string>> = {
  entero: "0",
  decimal: "0.0",
  // Notas y asistencia con la precisión que guarda la BD: un formato más corto redondearía 12,96 a «13,0».
  nota: "0.00",
  soles: '"S/" #,##0.00',
  // Los porcentajes se guardan como fracción (0,75) para que Excel los trate como tales.
  porcentaje: "0%",
  asistencia: "0.0%",
  fecha: "dd/mm/yyyy",
};

const CIAN = "#0E7490";

function celda(valor: ValorExcel, formato: FormatoExcel = "texto", estilo: Partial<Exclude<Cell, null | undefined | string>> = {}): Cell {
  if (valor === null || valor === "") return { value: "", type: String, ...estilo };
  if (typeof valor === "object" && "formato" in valor) return celda(valor.valor, valor.formato, estilo);
  if (valor instanceof Date) return { value: valor, type: Date, format: FORMATO_NUMERICO.fecha, ...estilo };
  if (typeof valor === "number") return { value: valor, type: Number, format: FORMATO_NUMERICO[formato] ?? "0.##", ...estilo };
  return { value: valor, type: String, ...estilo };
}

/** Nombre de hoja válido para Excel: máximo 31 caracteres y sin [ ] : * ? / \ */
const nombreHoja = (n: string) => n.replace(/[[\]:*?/\\]/g, " ").slice(0, 31);

/**
 * Hoja con título, subtítulo, cabecera fija (cian) y una fila de totales opcional.
 * Las filas deben venir en el orden de `columnas`.
 */
export function hojaExcel(h: {
  nombre: string;
  titulo: string;
  subtitulo?: string;
  columnas: ColumnaExcel[];
  filas: ValorExcel[][];
  totales?: ValorExcel[];
  nota?: string;
}): Sheet<Buffer> {
  const n = h.columnas.length;
  const data: Row[] = [
    [{ value: h.titulo, type: String, fontWeight: "bold", fontSize: 14, columnSpan: n }, ...Array(n - 1).fill(null)],
    [{ value: h.subtitulo ?? "", type: String, fontStyle: "italic", textColor: "#71717A", columnSpan: n }, ...Array(n - 1).fill(null)],
    [],
    h.columnas.map((c) => ({
      value: c.titulo,
      type: String,
      fontWeight: "bold",
      textColor: "#FFFFFF",
      backgroundColor: CIAN,
      align: c.formato && c.formato !== "texto" ? "right" : "left",
      wrap: true,
    })),
    ...h.filas.map((fila) => fila.map((v, i) => celda(v, h.columnas[i]?.formato))),
  ];
  if (h.totales) {
    data.push(h.totales.map((v, i) => celda(v, h.columnas[i]?.formato, { fontWeight: "bold", topBorderStyle: "thin", topBorderColor: "#18181B" })));
  }
  if (h.nota) data.push([], [{ value: h.nota, type: String, fontStyle: "italic", textColor: "#71717A", columnSpan: n }, ...Array(n - 1).fill(null)]);

  return {
    sheet: nombreHoja(h.nombre),
    data,
    columns: h.columnas.map((c) => ({ width: c.ancho })),
    stickyRowsCount: 4, // título, subtítulo, espacio y cabecera quedan visibles al desplazarse
  };
}

/** Libro .xlsx con las hojas indicadas. */
export async function libroExcel(hojas: Sheet<Buffer>[]): Promise<Buffer> {
  return writeXlsxFile(hojas, { fontFamily: "Calibri", fontSize: 11 }).toBuffer();
}

export const TIPO_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
