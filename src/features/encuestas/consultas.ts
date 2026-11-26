import "server-only";
import { uno } from "@/features/academico/consultas";
import { createClient } from "@/lib/supabase/server";
import { calcularResultados, type Aspecto, type EnvioEncuesta, type PreguntaEncuesta, type RespuestaEncuesta, type ResultadosEncuesta, type TipoPregunta } from "./resultados";

/** Una encuesta enviada al estudiante (pendiente o respondida). */
export interface EncuestaDelEstudiante {
  envioId: number;
  curso: string;
  titulo: string;
  enviadaEn: string;
  respondidaEn: string | null;
}

/** Una encuesta en la lista del administrador. */
export interface EncuestaAdmin {
  id: number;
  titulo: string;
  descripcion: string | null;
  activa: boolean;
  creadaEn: string;
  preguntas: number;
  enviadas: number;
  respondidas: number;
}

type FilaPregunta = { id: number; orden: number; enunciado: string; tipo: string; aspecto: string | null; obligatoria: boolean };
const aPregunta = (p: FilaPregunta): PreguntaEncuesta => ({
  id: p.id,
  orden: p.orden,
  enunciado: p.enunciado,
  tipo: p.tipo as TipoPregunta,
  aspecto: p.aspecto as Aspecto | null,
  obligatoria: p.obligatoria,
});

/** HU-43 · Encuestas que recibió el estudiante (RLS: solo las suyas), las pendientes primero. */
export async function listarEncuestasEstudiante(estudianteId: string): Promise<EncuestaDelEstudiante[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("encuesta_envios")
    .select("id, enviada_en, respondida_en, curso:cursos(titulo), encuesta:encuestas(titulo)")
    .eq("estudiante_id", estudianteId)
    .order("enviada_en", { ascending: false });
  return (data ?? [])
    .map((e) => ({
      envioId: e.id,
      curso: uno<{ titulo: string }>(e.curso)?.titulo ?? "Curso",
      titulo: uno<{ titulo: string }>(e.encuesta)?.titulo ?? "Encuesta de satisfacción",
      enviadaEn: e.enviada_en,
      respondidaEn: e.respondida_en,
    }))
    .sort((a, b) => Number(!!a.respondidaEn) - Number(!!b.respondidaEn));
}

/** HU-43 · Una encuesta para responder, si es del estudiante (RLS). */
export async function obtenerEncuestaParaResponder(envioId: number): Promise<{
  envioId: number;
  curso: string;
  titulo: string;
  descripcion: string | null;
  respondidaEn: string | null;
  preguntas: PreguntaEncuesta[];
} | null> {
  const supabase = await createClient();
  const { data: envio } = await supabase
    .from("encuesta_envios")
    .select("id, encuesta_id, respondida_en, curso:cursos(titulo), encuesta:encuestas(titulo, descripcion)")
    .eq("id", envioId)
    .maybeSingle();
  if (!envio) return null;
  const { data: preguntas } = await supabase
    .from("encuesta_preguntas")
    .select("id, orden, enunciado, tipo, aspecto, obligatoria")
    .eq("encuesta_id", envio.encuesta_id)
    .order("orden");
  const encuesta = uno<{ titulo: string; descripcion: string | null }>(envio.encuesta);
  return {
    envioId: envio.id,
    curso: uno<{ titulo: string }>(envio.curso)?.titulo ?? "Curso",
    titulo: encuesta?.titulo ?? "Encuesta de satisfacción",
    descripcion: encuesta?.descripcion ?? null,
    respondidaEn: envio.respondida_en,
    preguntas: ((preguntas ?? []) as FilaPregunta[]).map(aPregunta),
  };
}

/** HU-43 · Encuestas con sus totales (RLS: solo el administrador). */
export async function listarEncuestasAdmin(): Promise<EncuestaAdmin[]> {
  const supabase = await createClient();
  const [{ data: encuestas }, { data: preguntas }, { data: envios }] = await Promise.all([
    supabase.from("encuestas").select("id, titulo, descripcion, activa, creada_en").order("creada_en", { ascending: false }),
    supabase.from("encuesta_preguntas").select("encuesta_id"),
    supabase.from("encuesta_envios").select("encuesta_id, respondida_en"),
  ]);
  const cuenta = <T extends { encuesta_id: number }>(filas: T[] | null, id: number, filtro: (f: T) => boolean = () => true) =>
    (filas ?? []).filter((f) => f.encuesta_id === id && filtro(f)).length;
  return (encuestas ?? []).map((e) => ({
    id: e.id,
    titulo: e.titulo,
    descripcion: e.descripcion,
    activa: e.activa,
    creadaEn: e.creada_en,
    preguntas: cuenta(preguntas, e.id),
    enviadas: cuenta(envios, e.id),
    respondidas: cuenta(envios, e.id, (f) => !!f.respondida_en),
  }));
}

/** HU-43 · Una encuesta con sus preguntas; `bloqueada` si ya se envió (sus preguntas no cambian). */
export async function obtenerEncuestaAdmin(id: number): Promise<{
  id: number;
  titulo: string;
  descripcion: string | null;
  activa: boolean;
  bloqueada: boolean;
  preguntas: PreguntaEncuesta[];
} | null> {
  const supabase = await createClient();
  const [{ data: encuesta }, { data: preguntas }, { count }] = await Promise.all([
    supabase.from("encuestas").select("id, titulo, descripcion, activa").eq("id", id).maybeSingle(),
    supabase.from("encuesta_preguntas").select("id, orden, enunciado, tipo, aspecto, obligatoria").eq("encuesta_id", id).order("orden"),
    supabase.from("encuesta_envios").select("id", { count: "exact", head: true }).eq("encuesta_id", id),
  ]);
  if (!encuesta) return null;
  return { ...encuesta, bloqueada: (count ?? 0) > 0, preguntas: ((preguntas ?? []) as FilaPregunta[]).map(aPregunta) };
}

/** HU-43 · Resultados de una encuesta, opcionalmente de un curso (RLS: solo el administrador). */
export async function resultadosDeEncuesta(
  encuestaId: number,
  preguntas: PreguntaEncuesta[],
  cursoId?: string,
): Promise<{ resultados: ResultadosEncuesta; envios: EnvioEncuesta[]; respuestas: RespuestaEncuesta[] }> {
  const supabase = await createClient();
  let consulta = supabase.from("encuesta_envios").select("id, curso_id, enviada_en, respondida_en, curso:cursos(titulo)").eq("encuesta_id", encuestaId);
  if (cursoId) consulta = consulta.eq("curso_id", cursoId);
  const { data: filas } = await consulta;
  const envios: EnvioEncuesta[] = (filas ?? []).map((e) => ({
    id: e.id,
    cursoId: e.curso_id,
    curso: uno<{ titulo: string }>(e.curso)?.titulo ?? "Curso",
    enviadaEn: e.enviada_en,
    respondidaEn: e.respondida_en,
  }));
  const ids = envios.filter((e) => e.respondidaEn).map((e) => e.id);
  const { data: resp } = ids.length
    ? await supabase.from("encuesta_respuestas").select("envio_id, pregunta_id, valor, texto").in("envio_id", ids)
    : { data: [] };
  const respuestas: RespuestaEncuesta[] = (resp ?? []).map((r) => ({ envioId: r.envio_id, preguntaId: r.pregunta_id, valor: r.valor, texto: r.texto }));
  return { resultados: calcularResultados(preguntas, envios, respuestas), envios, respuestas };
}
