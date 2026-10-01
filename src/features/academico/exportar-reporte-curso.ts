import "server-only";
import { ASISTENCIA_MINIMA, NOTA_MINIMA } from "@/config/academico";
import { hojaExcel, libroExcel } from "@/lib/excel";
import { formatearFecha, formatearFechaCorta, hoyISO } from "@/lib/formato";
import { generarPdfReporte, type SeccionPdf } from "@/lib/pdf/reporte";
import type { EstadoAsistencia } from "@/types/dominio";
import { ETIQUETA_ESTADO_ACADEMICO, type ReporteCurso } from "./reporte-instructor";

const SIGLA_ASISTENCIA: Record<EstadoAsistencia, string> = { PRESENTE: "P", TARDANZA: "T", AUSENTE: "A" };
const nota = (n: number | null) => (n === null ? "—" : n.toFixed(1));
const porcentaje = (n: number | null) => (n === null ? "—" : `${Math.round(n)} %`);
const NOTA_CALCULO = `Nota final: promedio en escala vigesimal de la mejor nota de cada evaluación; las no rendidas cuentan 0. Apto: rindió todas las evaluaciones con nota final ≥ ${NOTA_MINIMA} y asistió al ${ASISTENCIA_MINIMA} % de las sesiones dictadas. En riesgo: asistencia o promedio parcial por debajo del mínimo. Asistencia: P presente, T tardanza (cuenta como asistencia), A ausente.`;

/** HU-42 · Reporte académico del curso en Excel: estudiantes con contacto, calificaciones y asistencia. */
export async function reporteCursoAExcel(r: ReporteCurso): Promise<Buffer> {
  const subtitulo = `Generado el ${formatearFecha(hoyISO())} · ${r.estudiantes.length} estudiantes confirmados`;
  return libroExcel([
    hojaExcel({
      nombre: "Estudiantes",
      titulo: `${r.curso.titulo} · Estudiantes`,
      subtitulo,
      columnas: [
        { titulo: "Estudiante", ancho: 32 },
        { titulo: "Correo", ancho: 32 },
        { titulo: "Teléfono", ancho: 14 },
        { titulo: "Avance", ancho: 9, formato: "porcentaje" },
        { titulo: "Asistencia", ancho: 11, formato: "porcentaje" },
        { titulo: "Nota final", ancho: 10, formato: "decimal" },
        { titulo: "Evaluaciones rendidas", ancho: 12 },
        { titulo: "Estado", ancho: 11 },
        { titulo: "Pendiente para el certificado", ancho: 60 },
      ],
      filas: r.estudiantes.map((e) => [
        e.nombre,
        e.correo,
        e.telefono ?? "",
        e.progreso / 100,
        e.asistencia === null ? null : e.asistencia / 100,
        e.notaFinal,
        `${e.rendidas} de ${r.evaluaciones.length}`,
        ETIQUETA_ESTADO_ACADEMICO[e.estado],
        e.motivos.join("; "),
      ]),
      nota: NOTA_CALCULO,
    }),
    hojaExcel({
      nombre: "Calificaciones",
      titulo: `${r.curso.titulo} · Calificaciones`,
      subtitulo: "Mejor puntaje de cada evaluación (sobre su puntaje total)",
      columnas: [
        { titulo: "Estudiante", ancho: 32 },
        ...r.evaluaciones.map((e) => ({ titulo: `${e.titulo} (/${e.puntaje_total})`, ancho: Math.min(Math.max(e.titulo.length + 6, 12), 28), formato: "decimal" as const })),
        { titulo: "Promedio parcial (/20)", ancho: 14, formato: "decimal" },
        { titulo: "Nota final (/20)", ancho: 12, formato: "decimal" },
      ],
      filas: r.estudiantes.map((e) => [e.nombre, ...e.notas, e.notaParcial, e.notaFinal]),
      nota: NOTA_CALCULO,
    }),
    hojaExcel({
      nombre: "Asistencia",
      titulo: `${r.curso.titulo} · Asistencia`,
      subtitulo: `${r.sesiones.length} sesiones dictadas · P presente, T tardanza, A ausente`,
      columnas: [
        { titulo: "Estudiante", ancho: 32 },
        ...r.sesiones.map((s) => ({ titulo: formatearFechaCorta(s.fecha), ancho: 8 })),
        { titulo: "Asistencias", ancho: 11, formato: "entero" },
        { titulo: "Asistencia", ancho: 11, formato: "porcentaje" },
      ],
      filas: r.estudiantes.map((e) => [
        e.nombre,
        ...e.asistenciaPorSesion.map((a) => (a ? SIGLA_ASISTENCIA[a] : "—")),
        e.presentes,
        e.asistencia === null ? null : e.asistencia / 100,
      ]),
    }),
  ]);
}

/** Máximo de columnas de sesiones o evaluaciones que caben legibles en el PDF horizontal. */
const MAX_COLUMNAS = 14;

/** HU-42 · Reporte académico del curso en PDF (A4 horizontal). */
export function reporteCursoAPdf(r: ReporteCurso): Promise<Uint8Array> {
  const e = r.estudiantes;
  const conNota = e.filter((x) => x.notaFinal !== null);
  const conAsistencia = e.filter((x) => x.asistencia !== null);
  const promedio = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

  const sesiones = r.sesiones.slice(-MAX_COLUMNAS);
  const desdeSesion = r.sesiones.length - sesiones.length;
  const evaluaciones = r.evaluaciones.slice(0, MAX_COLUMNAS);

  const secciones: SeccionPdf[] = [
    {
      titulo: "Estudiantes",
      columnas: [
        { titulo: "Estudiante", ancho: 24 },
        { titulo: "Correo", ancho: 24 },
        { titulo: "Teléfono", ancho: 11 },
        { titulo: "Avance", ancho: 7, alinear: "derecha" },
        { titulo: "Asistencia", ancho: 8, alinear: "derecha" },
        { titulo: "Nota final", ancho: 8, alinear: "derecha" },
        { titulo: "Rendidas", ancho: 7, alinear: "centro" },
        { titulo: "Estado", ancho: 9 },
      ],
      filas: e.map((x) => [
        x.nombre,
        x.correo,
        x.telefono ?? "—",
        `${x.progreso} %`,
        porcentaje(x.asistencia),
        nota(x.notaFinal),
        `${x.rendidas}/${r.evaluaciones.length}`,
        ETIQUETA_ESTADO_ACADEMICO[x.estado],
      ]),
      vacio: "Aún no hay estudiantes confirmados en este curso.",
    },
  ];
  if (evaluaciones.length) {
    secciones.push({
      titulo: r.evaluaciones.length > MAX_COLUMNAS ? `Calificaciones (primeras ${MAX_COLUMNAS} evaluaciones; el detalle completo está en el Excel)` : "Calificaciones",
      columnas: [
        { titulo: "Estudiante", ancho: 22 },
        ...evaluaciones.map((ev, i) => ({ titulo: `Ev. ${i + 1} (/${ev.puntaje_total})`, ancho: 7, alinear: "centro" as const })),
        { titulo: "Final /20", ancho: 7, alinear: "derecha" },
      ],
      filas: e.map((x) => [x.nombre, ...x.notas.slice(0, MAX_COLUMNAS).map((n) => (n === null ? "—" : String(n))), nota(x.notaFinal)]),
    });
  }
  if (sesiones.length) {
    secciones.push({
      titulo: desdeSesion ? `Asistencia (últimas ${MAX_COLUMNAS} sesiones; el detalle completo está en el Excel)` : "Asistencia",
      columnas: [
        { titulo: "Estudiante", ancho: 22 },
        ...sesiones.map((s) => ({ titulo: formatearFechaCorta(s.fecha), ancho: 5, alinear: "centro" as const })),
        { titulo: "Total", ancho: 6, alinear: "derecha" },
      ],
      filas: e.map((x) => [
        x.nombre,
        ...x.asistenciaPorSesion.slice(desdeSesion).map((a) => (a ? SIGLA_ASISTENCIA[a] : "—")),
        porcentaje(x.asistencia),
      ]),
    });
  }

  return generarPdfReporte({
    titulo: "Reporte académico del curso",
    subtitulo: r.curso.titulo,
    horizontal: true,
    resumen: [
      { etiqueta: "Estudiantes confirmados", valor: String(e.length) },
      { etiqueta: "Aptos para certificado", valor: String(e.filter((x) => x.estado === "APTO").length) },
      { etiqueta: "En riesgo", valor: String(e.filter((x) => x.estado === "EN_RIESGO").length) },
      { etiqueta: "Nota final promedio", valor: nota(promedio(conNota.map((x) => x.notaFinal!))), detalle: `${r.evaluaciones.length} evaluaciones` },
      { etiqueta: "Asistencia promedio", valor: porcentaje(promedio(conAsistencia.map((x) => x.asistencia!))), detalle: `${r.sesiones.length} sesiones dictadas` },
    ],
    secciones,
    nota: NOTA_CALCULO,
  });
}
