import { describe, expect, it } from "vitest";
import { hojaExcel, libroExcel } from "@/lib/excel";
import { leerXlsx } from "../../apoyo/archivos";

const hoja = () =>
  hojaExcel({
    nombre: "Por curso: 2026/09 [todos]",
    titulo: "Reporte de inscripciones",
    subtitulo: "Del 1 al 30 de setiembre",
    columnas: [
      { titulo: "Curso", ancho: 30 },
      { titulo: "Inscritos", ancho: 10, formato: "entero" },
      { titulo: "Ingresos", ancho: 12, formato: "soles" },
      { titulo: "Ocupación", ancho: 10, formato: "porcentaje" },
      { titulo: "Nota", ancho: 8, formato: "nota" },
    ],
    filas: [
      ["Excel avanzado", 12, 2160, 0.4, 12.96],
      ["Power BI", 0, 0, null, { valor: 0.755, formato: "asistencia" }],
    ],
    totales: ["Total", 12, 2160, "", null],
    nota: "Ingresos: pagos aprobados.",
  });

describe("hojas de Excel", () => {
  it("arma título, subtítulo, cabecera fija y totales", () => {
    const h = hoja();
    expect(h.sheet).toBe("Por curso  2026 09  todos ");
    expect(h.sheet!.length).toBeLessThanOrEqual(31);
    expect(h.stickyRowsCount).toBe(4);
    expect(h.columns).toEqual([{ width: 30 }, { width: 10 }, { width: 12 }, { width: 10 }, { width: 8 }]);
    const [titulo, , , cabecera, fila] = h.data;
    expect(titulo[0]).toMatchObject({ value: "Reporte de inscripciones", columnSpan: 5 });
    expect(cabecera.map((c) => (c as { value: string }).value)).toEqual(["Curso", "Inscritos", "Ingresos", "Ocupación", "Nota"]);
    expect(cabecera[1]).toMatchObject({ align: "right" });
    expect(fila[2]).toMatchObject({ value: 2160, type: Number, format: '"S/" #,##0.00' });
    expect(fila[4]).toMatchObject({ value: 12.96, format: "0.00" });
    expect(h.data[5][4]).toMatchObject({ value: 0.755, format: "0.0%" });
    expect(h.data[5][3]).toMatchObject({ value: "" });
    expect(h.data[6][0]).toMatchObject({ value: "Total", fontWeight: "bold" });
  });

  it("genera un .xlsx válido con los valores como números", async () => {
    const xlsx = leerXlsx(await libroExcel([hoja(), hojaExcel({ nombre: "Resumen", titulo: "Resumen", columnas: [{ titulo: "Fecha", ancho: 12, formato: "fecha" }], filas: [[new Date("2026-09-30T12:00:00Z")]] })]));
    expect(xlsx.hojas).toEqual(["Por curso  2026 09  todos ", "Resumen"]);
    const filas = xlsx.filas(0);
    expect(filas[0][0]).toBe("Reporte de inscripciones");
    expect(filas[3]).toEqual(["Curso", "Inscritos", "Ingresos", "Ocupación", "Nota"]);
    expect(filas[4]).toEqual(["Excel avanzado", "12", "2160", "0.4", "12.96"]);
    expect(filas.at(-1)![0]).toBe("Ingresos: pagos aprobados.");
    expect(xlsx.zip.get("xl/styles.xml")).toContain('formatCode="&quot;S/&quot; #,##0.00"');
    expect(xlsx.zip.get("xl/worksheets/sheet1.xml")).toMatch(/<pane [^>]*ySplit="4"/);
  });
});
