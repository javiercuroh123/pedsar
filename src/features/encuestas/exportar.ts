import "server-only";
import { hojaExcel, libroExcel } from "@/lib/excel";
import { formatearFecha, hoyISO } from "@/lib/formato";
import { ETIQUETA_ASPECTO, type EnvioEncuesta, type PreguntaEncuesta, type RespuestaEncuesta, type ResultadosEncuesta } from "./resultados";

const NOTA = "Escala de acuerdo del 1 (muy en desacuerdo) al 5 (muy de acuerdo). Satisfechos: respuestas con 4 o 5. Las respuestas no incluyen el nombre del estudiante.";
const fraccion = (pct: number | null) => (pct === null ? null : pct / 100);

/**
 * HU-43 · Resultados de una encuesta en Excel, para medir la mejora del proyecto:
 * indicadores, promedio por pregunta y por curso, y cada respuesta fechada (sin nombre).
 */
export async function resultadosAExcel(r: {
  titulo: string;
  curso: string | null;
  preguntas: PreguntaEncuesta[];
  envios: EnvioEncuesta[];
  respuestas: RespuestaEncuesta[];
  resultados: ResultadosEncuesta;
}): Promise<Buffer> {
  const res = r.resultados;
  const subtitulo = `${r.curso ?? "Todos los cursos"} · generado el ${formatearFecha(hoyISO())}`;
  const escala = r.preguntas.filter((p) => p.tipo === "ESCALA");
  const respondidos = r.envios.filter((e) => e.respondidaEn).sort((a, b) => a.respondidaEn!.localeCompare(b.respondidaEn!));
  const valor = (envioId: number, preguntaId: number) => r.respuestas.find((x) => x.envioId === envioId && x.preguntaId === preguntaId);

  return libroExcel([
    hojaExcel({
      nombre: "Resumen",
      titulo: `${r.titulo} · Resumen`,
      subtitulo,
      columnas: [
        { titulo: "Indicador", ancho: 40 },
        { titulo: "Valor", ancho: 14, formato: "decimal" },
      ],
      filas: [
        ["Encuestas enviadas", { valor: res.enviadas, formato: "entero" }],
        ["Encuestas respondidas", { valor: res.respondidas, formato: "entero" }],
        ["Tasa de respuesta", res.tasaRespuesta === null ? null : { valor: res.tasaRespuesta / 100, formato: "porcentaje" }],
        ["Índice de satisfacción (1 a 5)", res.indice],
        ["Satisfechos (respuestas con 4 o 5)", res.satisfechos === null ? null : { valor: res.satisfechos / 100, formato: "porcentaje" }],
        ...res.porAspecto.map((a): [string, number | null] => [`Promedio · ${ETIQUETA_ASPECTO[a.aspecto]}`, a.promedio]),
      ],
      nota: NOTA,
    }),
    hojaExcel({
      nombre: "Por pregunta",
      titulo: `${r.titulo} · Por pregunta`,
      subtitulo,
      columnas: [
        { titulo: "N.º", ancho: 6, formato: "entero" },
        { titulo: "Pregunta", ancho: 60 },
        { titulo: "Aspecto", ancho: 20 },
        { titulo: "Respuestas", ancho: 11, formato: "entero" },
        { titulo: "Promedio", ancho: 10, formato: "decimal" },
        { titulo: "Satisfechos", ancho: 11, formato: "porcentaje" },
        { titulo: "1", ancho: 6, formato: "entero" },
        { titulo: "2", ancho: 6, formato: "entero" },
        { titulo: "3", ancho: 6, formato: "entero" },
        { titulo: "4", ancho: 6, formato: "entero" },
        { titulo: "5", ancho: 6, formato: "entero" },
      ],
      filas: res.porPregunta
        .filter((p) => p.pregunta.tipo === "ESCALA")
        .map((p) => [p.pregunta.orden, p.pregunta.enunciado, ETIQUETA_ASPECTO[p.pregunta.aspecto!], p.respuestas, p.promedio, fraccion(p.satisfechos), ...p.distribucion]),
      nota: NOTA,
    }),
    hojaExcel({
      nombre: "Por curso",
      titulo: `${r.titulo} · Por curso`,
      subtitulo,
      columnas: [
        { titulo: "Curso", ancho: 40 },
        { titulo: "Enviadas", ancho: 10, formato: "entero" },
        { titulo: "Respondidas", ancho: 12, formato: "entero" },
        ...res.porAspecto.map((a) => ({ titulo: ETIQUETA_ASPECTO[a.aspecto], ancho: 14, formato: "decimal" as const })),
        { titulo: "Índice", ancho: 10, formato: "decimal" },
      ],
      filas: res.porCurso.map((c) => [c.curso, c.enviadas, c.respondidas, ...res.porAspecto.map((a) => c.porAspecto[a.aspecto] ?? null), c.general]),
    }),
    hojaExcel({
      nombre: "Respuestas",
      titulo: `${r.titulo} · Respuestas`,
      subtitulo: `${subtitulo} · una fila por encuesta respondida, sin nombre`,
      columnas: [
        { titulo: "Fecha", ancho: 12, formato: "fecha" },
        { titulo: "Curso", ancho: 36 },
        ...escala.map((p) => ({ titulo: `P${p.orden} · ${ETIQUETA_ASPECTO[p.aspecto!]}`, ancho: 14, formato: "entero" as const })),
        ...r.preguntas.filter((p) => p.tipo === "TEXTO").map((p) => ({ titulo: `P${p.orden} · ${p.enunciado}`, ancho: 50 })),
      ],
      filas: respondidos.map((e) => [
        new Date(e.respondidaEn!),
        e.curso,
        ...escala.map((p) => valor(e.id, p.id)?.valor ?? null),
        ...r.preguntas.filter((p) => p.tipo === "TEXTO").map((p) => valor(e.id, p.id)?.texto ?? ""),
      ]),
      nota: `Preguntas: ${r.preguntas.map((p) => `P${p.orden}. ${p.enunciado}`).join(" ")}`,
    }),
  ]);
}
