import "server-only";
import { hojaExcel, libroExcel, type ValorExcel } from "@/lib/excel";
import { ETIQUETA_METODO, ETIQUETA_MODALIDAD, formatearFecha, formatearSoles } from "@/lib/formato";
import { generarPdfReporte } from "@/lib/pdf/reporte";
import type { MetodoPago } from "@/types/dominio";
import { etiquetaMes, type ReporteGeneral } from "./reportes";

const fraccion = (parte: number, total: number) => (total ? parte / total : 0);
const pct = (parte: number, total: number) => `${Math.round(fraccion(parte, total) * 100)} %`;
const periodo = (r: ReporteGeneral) => `Del ${formatearFecha(r.desde)} al ${formatearFecha(r.hasta)}${r.curso ? ` · ${r.curso}` : " · Todos los cursos"}`;
const NOTA = "Inscripciones activas (sin las canceladas) registradas en el periodo; ingresos = pagos aprobados de esas inscripciones; ocupación = inscripciones activas / cupo del curso. Los indicadores de usuarios son globales.";

/** RF-10 · Reporte del administrador en Excel: resumen, por curso, por método de pago y por mes. */
export async function reporteAExcel(r: ReporteGeneral): Promise<Buffer> {
  const metodos = (Object.keys(ETIQUETA_METODO) as MetodoPago[]).filter((m) => r.porCurso.some((f) => f.porMetodo[m]));
  const subtitulo = periodo(r);
  const t = r.totales;
  const resumen: [string, ValorExcel][] = [
    ["Periodo", `${formatearFecha(r.desde)} al ${formatearFecha(r.hasta)}`],
    ["Curso", r.curso ?? "Todos los cursos"],
    ["Inscripciones", t.inscritos],
    ["Inscripciones confirmadas", t.confirmados],
    ["Tasa de confirmación", { valor: fraccion(t.confirmados, t.inscritos), formato: "porcentaje" }],
    ["Ingresos aprobados", { valor: t.ingresos, formato: "soles" }],
    ["Ticket promedio por matrícula confirmada", { valor: t.confirmados ? t.ingresos / t.confirmados : 0, formato: "soles" }],
    ["Usuarios registrados (total)", r.usuarios.registrados],
    ["Usuarios activos", r.usuarios.activos],
    ["Usuarios nuevos en el periodo", r.usuarios.nuevos],
    ["Estudiantes", r.usuarios.estudiantes],
    ["Instructores", r.usuarios.instructores],
  ];

  return libroExcel([
    hojaExcel({
      nombre: "Resumen",
      titulo: "Reporte de inscripciones e ingresos · PEDSAR",
      subtitulo,
      columnas: [
        { titulo: "Indicador", ancho: 42 },
        { titulo: "Valor", ancho: 26, formato: "entero" },
      ],
      filas: resumen,
      nota: NOTA,
    }),
    hojaExcel({
      nombre: "Por curso",
      titulo: "Inscripciones e ingresos por curso",
      subtitulo,
      columnas: [
        { titulo: "Curso", ancho: 44 },
        { titulo: "Modalidad", ancho: 16 },
        { titulo: "Cupo", ancho: 8, formato: "entero" },
        { titulo: "Inscritos", ancho: 10, formato: "entero" },
        { titulo: "Confirmados", ancho: 12, formato: "entero" },
        { titulo: "Ocupación", ancho: 11, formato: "porcentaje" },
        { titulo: "Ingresos", ancho: 14, formato: "soles" },
        ...metodos.map((m) => ({ titulo: ETIQUETA_METODO[m], ancho: 14, formato: "soles" as const })),
      ],
      filas: r.porCurso.map((f) => [
        f.titulo,
        ETIQUETA_MODALIDAD[f.modalidad],
        f.cupo,
        f.inscritos,
        f.confirmados,
        fraccion(f.inscritos, f.cupo),
        f.ingresos,
        ...metodos.map((m) => f.porMetodo[m] ?? 0),
      ]),
      totales: [
        "Total",
        "",
        r.porCurso.reduce((a, f) => a + f.cupo, 0),
        t.inscritos,
        t.confirmados,
        fraccion(t.inscritos, r.porCurso.reduce((a, f) => a + f.cupo, 0)),
        t.ingresos,
        ...metodos.map((m) => r.porCurso.reduce((a, f) => a + (f.porMetodo[m] ?? 0), 0)),
      ],
    }),
    hojaExcel({
      nombre: "Por método de pago",
      titulo: "Ingresos por método de pago",
      subtitulo,
      columnas: [
        { titulo: "Método", ancho: 22 },
        { titulo: "Ingresos", ancho: 16, formato: "soles" },
        { titulo: "Participación", ancho: 14, formato: "porcentaje" },
      ],
      filas: r.porMetodo.map((m) => [ETIQUETA_METODO[m.metodo], m.monto, fraccion(m.monto, t.ingresos)]),
      totales: ["Total", t.ingresos, t.ingresos ? 1 : 0],
    }),
    hojaExcel({
      nombre: "Por mes",
      titulo: "Evolución mensual",
      subtitulo,
      columnas: [
        { titulo: "Mes", ancho: 14 },
        { titulo: "Inscripciones", ancho: 14, formato: "entero" },
        { titulo: "Confirmadas", ancho: 13, formato: "entero" },
        { titulo: "Ingresos", ancho: 16, formato: "soles" },
      ],
      filas: r.porMes.map((m) => [etiquetaMes(m.mes), m.inscritos, m.confirmados, m.ingresos]),
      totales: ["Total", t.inscritos, t.confirmados, t.ingresos],
    }),
  ]);
}

/** RF-10 · Reporte del administrador en PDF (A4 horizontal). */
export function reporteAPdf(r: ReporteGeneral): Promise<Uint8Array> {
  const t = r.totales;
  const cupoTotal = r.porCurso.reduce((a, f) => a + f.cupo, 0);
  return generarPdfReporte({
    titulo: "Reporte de inscripciones e ingresos",
    subtitulo: periodo(r),
    horizontal: true,
    resumen: [
      { etiqueta: "Inscripciones", valor: String(t.inscritos) },
      { etiqueta: "Confirmadas", valor: String(t.confirmados), detalle: `${pct(t.confirmados, t.inscritos)} del total` },
      { etiqueta: "Ingresos aprobados", valor: formatearSoles(t.ingresos) },
      { etiqueta: "Ticket promedio", valor: formatearSoles(t.confirmados ? t.ingresos / t.confirmados : 0), detalle: "por matrícula confirmada" },
      { etiqueta: "Usuarios nuevos", valor: String(r.usuarios.nuevos), detalle: `${r.usuarios.registrados} registrados · ${r.usuarios.activos} activos` },
    ],
    secciones: [
      {
        titulo: "Inscripciones e ingresos por curso",
        columnas: [
          { titulo: "Curso", ancho: 34 },
          { titulo: "Modalidad", ancho: 11 },
          { titulo: "Cupo", ancho: 6, alinear: "derecha" },
          { titulo: "Inscritos", ancho: 8, alinear: "derecha" },
          { titulo: "Confirmados", ancho: 9, alinear: "derecha" },
          { titulo: "Ocupación", ancho: 8, alinear: "derecha" },
          { titulo: "Ingresos", ancho: 11, alinear: "derecha" },
        ],
        filas: r.porCurso.map((f) => [
          f.titulo,
          ETIQUETA_MODALIDAD[f.modalidad],
          String(f.cupo),
          String(f.inscritos),
          String(f.confirmados),
          pct(f.inscritos, f.cupo),
          formatearSoles(f.ingresos),
        ]),
        totales: ["Total", "", String(cupoTotal), String(t.inscritos), String(t.confirmados), pct(t.inscritos, cupoTotal), formatearSoles(t.ingresos)],
        vacio: "No hubo inscripciones en el periodo.",
      },
      {
        titulo: "Ingresos por método de pago",
        columnas: [
          { titulo: "Método", ancho: 3 },
          { titulo: "Ingresos", ancho: 2, alinear: "derecha" },
          { titulo: "Participación", ancho: 2, alinear: "derecha" },
        ],
        filas: r.porMetodo.map((m) => [ETIQUETA_METODO[m.metodo], formatearSoles(m.monto), pct(m.monto, t.ingresos)]),
        totales: ["Total", formatearSoles(t.ingresos), t.ingresos ? "100 %" : "0 %"],
        vacio: "Sin pagos aprobados en el periodo.",
      },
      {
        titulo: "Evolución mensual",
        columnas: [
          { titulo: "Mes", ancho: 3 },
          { titulo: "Inscripciones", ancho: 2, alinear: "derecha" },
          { titulo: "Confirmadas", ancho: 2, alinear: "derecha" },
          { titulo: "Ingresos", ancho: 2, alinear: "derecha" },
        ],
        filas: r.porMes.map((m) => [etiquetaMes(m.mes), String(m.inscritos), String(m.confirmados), formatearSoles(m.ingresos)]),
        totales: ["Total", String(t.inscritos), String(t.confirmados), formatearSoles(t.ingresos)],
        vacio: "No hubo inscripciones en el periodo.",
      },
    ],
    nota: NOTA,
  });
}
