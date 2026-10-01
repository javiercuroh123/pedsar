import { inflateRawSync } from "node:zlib";
import { decodePDFRawStream, PDFArray, PDFDocument, PDFRawStream, type PDFPage } from "pdf-lib";

/** Archivos de un .zip (un .xlsx es un zip de XML), por nombre. */
export function leerZip(buf: Buffer): Map<string, string> {
  const fin = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const total = buf.readUInt16LE(fin + 10);
  let p = buf.readUInt32LE(fin + 16);
  const archivos = new Map<string, string>();
  for (let i = 0; i < total; i++) {
    const metodo = buf.readUInt16LE(p + 10);
    const comprimido = buf.readUInt32LE(p + 20);
    const [largoNombre, largoExtra, largoComentario] = [buf.readUInt16LE(p + 28), buf.readUInt16LE(p + 30), buf.readUInt16LE(p + 32)];
    const local = buf.readUInt32LE(p + 42);
    const nombre = buf.toString("utf8", p + 46, p + 46 + largoNombre);
    const inicio = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const datos = buf.subarray(inicio, inicio + comprimido);
    archivos.set(nombre, (metodo === 8 ? inflateRawSync(datos) : datos).toString("utf8"));
    p += 46 + largoNombre + largoExtra + largoComentario;
  }
  return archivos;
}

const desescapar = (s: string) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

const indiceColumna = (letras: string) => [...letras].reduce((n, l) => n * 26 + l.charCodeAt(0) - 64, 0) - 1;

/** Libro .xlsx legible: nombres de hoja, filas de cada hoja (como texto) y los XML crudos. */
export function leerXlsx(buf: Buffer) {
  const zip = leerZip(buf);
  const compartidas = [...(zip.get("xl/sharedStrings.xml") ?? "").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
    desescapar([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join("")),
  );
  const hojas = [...(zip.get("xl/workbook.xml") ?? "").matchAll(/<sheet [^>]*name="([^"]*)"/g)].map((m) => desescapar(m[1]));

  const filas = (n: number) => {
    const xml = zip.get(`xl/worksheets/sheet${n + 1}.xml`) ?? "";
    return [...xml.matchAll(/<row [^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)].map((fila) => {
      const valores: string[] = [];
      for (const c of (fila[1] ?? "").matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const tipo = /t="(\w+)"/.exec(c[2])?.[1];
        const v = /<v>([\s\S]*?)<\/v>/.exec(c[3] ?? "")?.[1];
        const inline = /<t[^>]*>([\s\S]*?)<\/t>/.exec(c[3] ?? "")?.[1];
        valores[indiceColumna(c[1])] = tipo === "s" ? compartidas[Number(v)] : tipo === "inlineStr" ? desescapar(inline ?? "") : desescapar(v ?? "");
      }
      return Array.from(valores, (v) => v ?? "");
    });
  };
  return { zip, hojas, filas, hoja: (nombre: string) => filas(hojas.indexOf(nombre)) };
}

// Caracteres de WinAnsi entre 0x80 y 0x9F que usan los PDF del sistema.
const WIN_ANSI: Record<number, string> = { 0x80: "€", 0x85: "…", 0x91: "‘", 0x92: "’", 0x93: "“", 0x94: "”", 0x95: "•", 0x96: "–", 0x97: "—" };

function contenidoDe(pagina: PDFPage) {
  const contenidos = pagina.node.Contents();
  const flujos = contenidos instanceof PDFArray ? contenidos.asArray().map((r) => pagina.doc.context.lookup(r)) : [contenidos];
  return flujos
    .filter((f): f is PDFRawStream => f instanceof PDFRawStream)
    .map((f) => Buffer.from(decodePDFRawStream(f).decode()).toString("latin1"))
    .join("\n");
}

/** Textos dibujados en cada página de un PDF hecho con pdf-lib (fuentes estándar). */
export async function leerPdf(bytes: Uint8Array) {
  const doc = await PDFDocument.load(bytes);
  const paginas = doc.getPages().map((p) =>
    [...contenidoDe(p).matchAll(/<([0-9A-Fa-f]*)>\s*Tj/g)]
      .map((m) => [...Buffer.from(m[1], "hex")].map((b) => WIN_ANSI[b] ?? String.fromCharCode(b)).join(""))
      .join("\n"),
  );
  return { doc, paginas, texto: paginas.join("\n"), tamanos: doc.getPages().map((p) => p.getSize()) };
}
