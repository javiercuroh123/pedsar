import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { aWinAnsi, centrado, dibujarIsotipo, partir, recortar, tamanoQueEntra } from "@/lib/pdf/comun";
import { generarPdfComprobante } from "@/features/matricula/pdf-comprobante";
import { generarPdfReporte } from "@/lib/pdf/reporte";
import { leerPdf } from "../../apoyo/archivos";

const fuente = async () => (await PDFDocument.create()).embedFont(StandardFonts.Helvetica);

describe("texto compatible con las fuentes estándar del PDF", () => {
  it("conserva tildes, ñ y signos del español", () => {
    expect(aWinAnsi("¿Señor Núñez? ¡Sí! Nº 1 – «curso» …")).toBe("¿Señor Núñez? ¡Sí! Nº 1 – «curso» …");
  });

  it("reemplaza símbolos sin equivalente y quita diacríticos ajenos a WinAnsi", () => {
    expect(aWinAnsi("nota ≥ 13 → apto ✓")).toBe("nota >= 13 -> apto v");
    expect(aWinAnsi("Ștefan Đorđe Łukasz 😀")).toBe("Stefan Dorde Lukasz");
  });

  it("une los espacios y saltos de línea", () => {
    expect(aWinAnsi("  uno\n\tdos   tres ")).toBe("uno dos tres");
  });

  it("parte, recorta y ajusta el tamaño al ancho disponible", async () => {
    const f = await fuente();
    const lineas = partir("Seguridad y salud en el trabajo para supervisores de obra", f, 12, 150);
    expect(lineas.length).toBeGreaterThan(1);
    expect(lineas.every((l) => f.widthOfTextAtSize(l, 12) <= 150 || !l.includes(" "))).toBe(true);
    expect(lineas.join(" ")).toBe("Seguridad y salud en el trabajo para supervisores de obra");

    expect(recortar("corto", f, 12, 200)).toBe("corto");
    const recortado = recortar("Un título demasiado largo para la columna", f, 10, 80);
    expect(recortado.endsWith("…")).toBe(true);
    expect(f.widthOfTextAtSize(recortado, 10)).toBeLessThanOrEqual(80);

    expect(tamanoQueEntra("Nombre muy largo de un estudiante", f, 30, 10, 200)).toBeLessThan(30);
    expect(tamanoQueEntra("Ana", f, 30, 10, 200)).toBe(30);
  });

  it("dibuja texto centrado e isotipo sin errores", async () => {
    const doc = await PDFDocument.create();
    const pagina = doc.addPage();
    const f = await doc.embedFont(StandardFonts.Helvetica);
    centrado(pagina, "CERTIFICADO", 500, f, 20, undefined, 3);
    centrado(pagina, "Otorgado a", 450, f, 12);
    dibujarIsotipo(pagina, 40, 40, 32);
    const { texto } = await leerPdf(await doc.save());
    expect(texto).toContain("CERTIFICADO");
    expect(texto).toContain("Otorgado a");
  });
});

describe("PDF tabular de reportes", () => {
  const filas = (n: number) => Array.from({ length: n }, (_, i) => [`Curso ${i + 1}`, String(i), `S/ ${i}.00`]);
  const columnas = [
    { titulo: "Curso", ancho: 3 },
    { titulo: "Inscritos", ancho: 1, alinear: "derecha" as const },
    { titulo: "Ingresos", ancho: 1, alinear: "derecha" as const },
  ];

  it("pagina tablas largas repitiendo la cabecera y numera las páginas", async () => {
    const bytes = await generarPdfReporte({
      titulo: "Reporte general",
      subtitulo: "Del 1 al 30 de setiembre",
      resumen: [{ etiqueta: "Ingresos", valor: "S/ 1,200.00", detalle: "pagos aprobados" }],
      secciones: [{ titulo: "Por curso", columnas, filas: filas(90) }],
      nota: "Las inscripciones canceladas no se cuentan.",
    });
    const { paginas, tamanos } = await leerPdf(bytes);
    expect(paginas.length).toBeGreaterThan(1);
    expect(tamanos[0].height).toBeGreaterThan(tamanos[0].width); // vertical por defecto
    expect(paginas[0]).toContain("Reporte general");
    expect(paginas[0]).toContain("S/ 1,200.00");
    expect(paginas[1]).toContain("Por curso (continuación)");
    expect(paginas[1]).toContain("Inscritos");
    paginas.forEach((p, i) => expect(p).toContain(`Página ${i + 1} de ${paginas.length}`));
    expect(paginas.join("\n")).toContain("Curso 90");
    expect(paginas.at(-1)).toContain("Las inscripciones canceladas no se cuentan.");
  });

  it("usa A4 horizontal y muestra el texto de tabla vacía", async () => {
    const bytes = await generarPdfReporte({
      titulo: "Reporte",
      subtitulo: "Curso sin estudiantes",
      resumen: [],
      horizontal: true,
      secciones: [{ titulo: "Estudiantes", columnas, filas: [], vacio: "Aún no hay estudiantes." }],
    });
    const { paginas, tamanos } = await leerPdf(bytes);
    expect(tamanos[0].width).toBeGreaterThan(tamanos[0].height);
    expect(paginas[0]).toContain("Aún no hay estudiantes.");
  });
});

describe("comprobante de pago interno (HU-12 · HU-30)", () => {
  const datos = {
    serie: "CP01",
    numero: "000123",
    fechaEmision: "2026-10-02",
    tipoSolicitado: "FACTURA" as const,
    cliente: { nombre: "Ana Quispe", documento: "71234567", ruc: "20123456789", razonSocial: "ACME SAC" },
    concepto: "Excel empresarial con tablas dinámicas",
    subtotal: 180,
    descuento: 36,
    total: 144,
    pago: "Culqi · Tarjeta",
    referencia: "chr_test_1",
  };

  it("muestra la empresa, el cliente con su RUC, los importes, el pago y la nota de que no es un comprobante SUNAT", async () => {
    const { texto, tamanos } = await leerPdf(await generarPdfComprobante(datos));
    const plano = texto.replace(/\s+/g, " ");
    expect(tamanos[0].width).toBeLessThan(tamanos[0].height);
    for (const esperado of ["CP01-000123", "20605615521", "ACME SAC", "20123456789", "Ana Quispe", "Excel empresarial con tablas dinámicas", "S/ 180.00", "S/ 36.00", "S/ 144.00", "Culqi · Tarjeta", "chr_test_1"]) {
      expect(plano).toContain(esperado);
    }
    expect(plano).toContain("no reemplaza la boleta o factura electrónica SUNAT");
  });

  it("sin factura muestra el nombre y documento del cliente, y omite el descuento y la referencia que no hay", async () => {
    const { texto } = await leerPdf(
      await generarPdfComprobante({ ...datos, tipoSolicitado: "BOLETA", cliente: { nombre: "Beto Ramos", documento: null, ruc: null, razonSocial: null }, descuento: 0, subtotal: 144, pago: "Yape", referencia: null }),
    );
    const plano = texto.replace(/\s+/g, " ");
    expect(plano).toContain("Beto Ramos");
    expect(plano).not.toContain("RUC del cliente");
    expect(plano).not.toContain("Descuento");
    expect(plano).not.toContain("Referencia");
  });
});
