/**
 * HU-43 · Etiquetas y cálculo de resultados de las encuestas de satisfacción.
 * Sin dependencias de servidor: lo usan las páginas, el Excel y las pruebas.
 */

export type Aspecto = "CONTENIDO" | "INSTRUCTOR" | "PLATAFORMA" | "GENERAL";
export type TipoPregunta = "ESCALA" | "TEXTO";

export const ASPECTOS: Aspecto[] = ["CONTENIDO", "INSTRUCTOR", "PLATAFORMA", "GENERAL"];

export const ETIQUETA_ASPECTO: Record<Aspecto, string> = {
  CONTENIDO: "Contenido",
  INSTRUCTOR: "Instructor",
  PLATAFORMA: "Plataforma",
  GENERAL: "Satisfacción general",
};

/** Escala de acuerdo de 1 a 5 (Likert). */
export const ESCALA: { valor: number; etiqueta: string }[] = [
  { valor: 1, etiqueta: "Muy en desacuerdo" },
  { valor: 2, etiqueta: "En desacuerdo" },
  { valor: 3, etiqueta: "Ni de acuerdo ni en desacuerdo" },
  { valor: 4, etiqueta: "De acuerdo" },
  { valor: 5, etiqueta: "Muy de acuerdo" },
];

export interface PreguntaEncuesta {
  id: number;
  orden: number;
  enunciado: string;
  tipo: TipoPregunta;
  aspecto: Aspecto | null;
  obligatoria: boolean;
}

export interface EnvioEncuesta {
  id: number;
  cursoId: string;
  curso: string;
  enviadaEn: string;
  respondidaEn: string | null;
}

export interface RespuestaEncuesta {
  envioId: number;
  preguntaId: number;
  valor: number | null;
  texto: string | null;
}

export interface ResultadoPregunta {
  pregunta: PreguntaEncuesta;
  respuestas: number;
  promedio: number | null;
  /** Cantidad de respuestas con 1, 2, 3, 4 y 5. */
  distribucion: [number, number, number, number, number];
  /** % de respuestas con 4 o 5 («de acuerdo» o «muy de acuerdo»). */
  satisfechos: number | null;
}

export interface ResultadoCurso {
  cursoId: string;
  curso: string;
  enviadas: number;
  respondidas: number;
  porAspecto: Partial<Record<Aspecto, number>>;
  general: number | null;
}

export interface Comentario {
  pregunta: string;
  texto: string;
  curso: string;
  fecha: string;
}

export interface ResultadosEncuesta {
  enviadas: number;
  respondidas: number;
  /** % de encuestas respondidas sobre las enviadas. */
  tasaRespuesta: number | null;
  porAspecto: { aspecto: Aspecto; promedio: number | null; respuestas: number }[];
  /** Promedio de todas las preguntas de escala (índice de satisfacción, 1 a 5). */
  indice: number | null;
  /** % de respuestas de escala con 4 o 5. */
  satisfechos: number | null;
  porPregunta: ResultadoPregunta[];
  porCurso: ResultadoCurso[];
  comentarios: Comentario[];
}

const redondear = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
const promedio = (vs: number[]) => (vs.length ? redondear(vs.reduce((a, b) => a + b, 0) / vs.length) : null);
const porcentaje = (parte: number, total: number) => (total ? redondear((parte * 100) / total, 1) : null);

/**
 * Resultados de una encuesta: solo cuentan las respuestas de envíos respondidos.
 * Los comentarios se entregan sin nombre (la encuesta es anónima en pantalla).
 */
export function calcularResultados(preguntas: PreguntaEncuesta[], envios: EnvioEncuesta[], respuestas: RespuestaEncuesta[]): ResultadosEncuesta {
  const respondidos = new Map(envios.filter((e) => e.respondidaEn).map((e) => [e.id, e]));
  const validas = respuestas.filter((r) => respondidos.has(r.envioId));
  const escala = new Map(preguntas.filter((p) => p.tipo === "ESCALA").map((p) => [p.id, p]));
  const valores = validas.filter((r) => r.valor !== null && escala.has(r.preguntaId)) as (RespuestaEncuesta & { valor: number })[];

  const porPregunta = [...preguntas]
    .sort((a, b) => a.orden - b.orden)
    .map((pregunta): ResultadoPregunta => {
      const vs = valores.filter((r) => r.preguntaId === pregunta.id).map((r) => r.valor);
      const distribucion = [1, 2, 3, 4, 5].map((n) => vs.filter((v) => v === n).length) as ResultadoPregunta["distribucion"];
      const textos = validas.filter((r) => r.preguntaId === pregunta.id && r.texto).length;
      return {
        pregunta,
        respuestas: pregunta.tipo === "ESCALA" ? vs.length : textos,
        promedio: promedio(vs),
        distribucion,
        satisfechos: porcentaje(vs.filter((v) => v >= 4).length, vs.length),
      };
    });

  const deAspecto = (lista: typeof valores, a: Aspecto) => lista.filter((r) => escala.get(r.preguntaId)?.aspecto === a).map((r) => r.valor);
  const aspectosUsados = ASPECTOS.filter((a) => [...escala.values()].some((p) => p.aspecto === a));

  const cursos = new Map<string, ResultadoCurso>();
  for (const e of envios) {
    const c = cursos.get(e.cursoId) ?? { cursoId: e.cursoId, curso: e.curso, enviadas: 0, respondidas: 0, porAspecto: {}, general: null };
    c.enviadas++;
    if (e.respondidaEn) c.respondidas++;
    cursos.set(e.cursoId, c);
  }
  for (const c of cursos.values()) {
    const delCurso = valores.filter((r) => respondidos.get(r.envioId)?.cursoId === c.cursoId);
    for (const a of aspectosUsados) {
      const p = promedio(deAspecto(delCurso, a));
      if (p !== null) c.porAspecto[a] = p;
    }
    c.general = promedio(delCurso.map((r) => r.valor));
  }

  const comentarios = validas
    .filter((r) => r.texto)
    .map((r) => {
      const envio = respondidos.get(r.envioId)!;
      return { pregunta: preguntas.find((p) => p.id === r.preguntaId)?.enunciado ?? "", texto: r.texto!, curso: envio.curso, fecha: envio.respondidaEn! };
    })
    .sort((a, b) => b.fecha.localeCompare(a.fecha));

  return {
    enviadas: envios.length,
    respondidas: respondidos.size,
    tasaRespuesta: porcentaje(respondidos.size, envios.length),
    porAspecto: aspectosUsados.map((aspecto) => {
      const vs = deAspecto(valores, aspecto);
      return { aspecto, promedio: promedio(vs), respuestas: vs.length };
    }),
    indice: promedio(valores.map((r) => r.valor)),
    satisfechos: porcentaje(valores.filter((r) => r.valor >= 4).length, valores.length),
    porPregunta,
    porCurso: [...cursos.values()].sort((a, b) => b.respondidas - a.respondidas || a.curso.localeCompare(b.curso, "es")),
    comentarios,
  };
}

/** Valida las respuestas del formulario antes de enviarlas a la BD (que vuelve a validar). */
export function validarRespuestas(preguntas: PreguntaEncuesta[], respuestas: Record<string, unknown>): { ok: true; datos: Record<string, number | string> } | { ok: false; mensaje: string } {
  const datos: Record<string, number | string> = {};
  for (const p of preguntas) {
    const crudo = respuestas[String(p.id)];
    if (p.tipo === "ESCALA") {
      const n = typeof crudo === "string" && /^[1-5]$/.test(crudo) ? Number(crudo) : typeof crudo === "number" ? crudo : null;
      if (n !== null && (!Number.isInteger(n) || n < 1 || n > 5)) return { ok: false, mensaje: "Califica cada afirmación del 1 al 5" };
      if (n === null && p.obligatoria) return { ok: false, mensaje: "Responde todas las preguntas obligatorias" };
      if (n !== null) datos[p.id] = n;
    } else {
      const t = typeof crudo === "string" ? crudo.trim() : "";
      if (t.length > 1000) return { ok: false, mensaje: "Cada comentario admite hasta 1000 caracteres" };
      if (!t && p.obligatoria) return { ok: false, mensaje: "Responde todas las preguntas obligatorias" };
      if (t) datos[p.id] = t;
    }
  }
  return { ok: true, datos };
}
