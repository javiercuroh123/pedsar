import "server-only";
import { uno } from "@/features/academico/consultas";
import { nombreCompleto } from "@/lib/formato";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** Una conversación en la lista del estudiante o en la bandeja del instructor. */
export interface ConversacionResumen {
  /** null si el estudiante aún no escribió en ese curso. */
  id: number | null;
  cursoId: string;
  curso: string;
  /** El otro participante: el instructor (para el estudiante) o el estudiante (para el instructor). */
  otro: string;
  ultimoMensaje: string | null;
  ultimoEn: string | null;
  noLeidos: number;
}

export interface Mensaje {
  id: number;
  texto: string;
  enviadoEn: string;
  propio: boolean;
  /** El otro participante ya lo leyó. */
  leido: boolean;
}

type Cliente = Awaited<ReturnType<typeof createClient>>;
type FilaConversacion = { id: number; curso_id: string; estudiante_id?: string; ultimo_mensaje_en: string; curso?: unknown; mensajes?: unknown };

/**
 * Los lados de una conversación son «el estudiante» y «el instructor del curso», sea quien sea hoy:
 * si se reasigna el curso, los mensajes del instructor anterior siguen siendo del lado del instructor.
 */
const esDelEstudiante = (autorId: string, estudianteId: string) => autorId === estudianteId;

/** Mensajes del otro lado que el usuario aún no leyó, por conversación. */
async function noLeidosPor(supabase: Cliente, conversaciones: { id: number; estudianteId: string }[], lado: "estudiante" | "instructor") {
  const cuenta = new Map<number, number>();
  if (!conversaciones.length) return cuenta;
  const estudiante = new Map(conversaciones.map((c) => [c.id, c.estudianteId]));
  const { data } = await supabase.from("mensajes").select("conversacion_id, autor_id").in("conversacion_id", [...estudiante.keys()]).is("leido_en", null);
  for (const m of data ?? []) {
    const delEstudiante = esDelEstudiante(m.autor_id, estudiante.get(m.conversacion_id) ?? "");
    if (delEstudiante === (lado === "instructor")) cuenta.set(m.conversacion_id, (cuenta.get(m.conversacion_id) ?? 0) + 1);
  }
  return cuenta;
}

/** Nombres públicos de instructores (la tabla perfiles no es legible entre usuarios). */
async function nombresInstructores(supabase: Cliente, ids: string[]) {
  const nombres = new Map<string, string>();
  if (!ids.length) return nombres;
  const { data } = await supabase.rpc("instructores_publicos", { p_ids: ids });
  for (const i of (data ?? []) as { id: string; nombres: string; apellidos: string }[]) nombres.set(i.id, nombreCompleto(i));
  return nombres;
}

/** Nombres de estudiantes cuyas conversaciones el instructor ya pudo leer (RLS). */
async function nombresEstudiantes(ids: string[]) {
  const nombres = new Map<string, string>();
  if (!ids.length) return nombres;
  const { data } = await createAdminClient().from("perfiles").select("id, nombres, apellidos").in("id", ids);
  for (const e of data ?? []) nombres.set(e.id, nombreCompleto(e));
  return nombres;
}

const ultimoMensaje = (c: FilaConversacion) => uno<{ texto: string; enviado_en: string }>(c.mensajes);

/** HU-19 · Un chat por curso confirmado del estudiante, exista o no la conversación. */
export async function listarConversacionesEstudiante(estudianteId: string): Promise<ConversacionResumen[]> {
  const supabase = await createClient();
  const [{ data: inscripciones }, { data: conversaciones }] = await Promise.all([
    supabase.from("inscripciones").select("curso:cursos(id, titulo, instructor_id)").eq("estudiante_id", estudianteId).eq("estado", "CONFIRMADA"),
    supabase
      .from("conversaciones")
      .select("id, curso_id, ultimo_mensaje_en, mensajes(texto, enviado_en)")
      .eq("estudiante_id", estudianteId)
      .order("enviado_en", { referencedTable: "mensajes", ascending: false })
      .limit(1, { referencedTable: "mensajes" }),
  ]);
  const cursos = (inscripciones ?? [])
    .map((i) => uno<{ id: string; titulo: string; instructor_id: string | null }>(i.curso))
    .filter((c): c is { id: string; titulo: string; instructor_id: string | null } => Boolean(c));
  const filas = (conversaciones ?? []) as FilaConversacion[];
  const [noLeidos, instructores] = await Promise.all([
    noLeidosPor(supabase, filas.map((c) => ({ id: c.id, estudianteId })), "estudiante"),
    nombresInstructores(supabase, [...new Set(cursos.map((c) => c.instructor_id).filter((x): x is string => Boolean(x)))]),
  ]);

  return cursos
    .map((curso) => {
      const c = filas.find((f) => f.curso_id === curso.id);
      const ultimo = c ? ultimoMensaje(c) : null;
      return {
        id: c?.id ?? null,
        cursoId: curso.id,
        curso: curso.titulo,
        otro: (curso.instructor_id && instructores.get(curso.instructor_id)) || "Sin instructor asignado",
        ultimoMensaje: ultimo?.texto ?? null,
        ultimoEn: ultimo?.enviado_en ?? null,
        noLeidos: c ? (noLeidos.get(c.id) ?? 0) : 0,
      };
    })
    .sort((a, b) => (b.ultimoEn ?? "").localeCompare(a.ultimoEn ?? ""));
}

/** HU-19 · HU-54 · Bandeja del instructor: sus conversaciones (RLS), las más recientes primero. */
export async function listarBandejaInstructor(cursoId?: string): Promise<ConversacionResumen[]> {
  const supabase = await createClient();
  let consulta = supabase
    .from("conversaciones")
    .select("id, curso_id, estudiante_id, ultimo_mensaje_en, curso:cursos(titulo), mensajes(texto, enviado_en)")
    .order("ultimo_mensaje_en", { ascending: false })
    .order("enviado_en", { referencedTable: "mensajes", ascending: false })
    .limit(1, { referencedTable: "mensajes" });
  if (cursoId) consulta = consulta.eq("curso_id", cursoId);
  const { data } = await consulta;
  const filas = (data ?? []) as FilaConversacion[];
  const [noLeidos, estudiantes] = await Promise.all([
    noLeidosPor(supabase, filas.map((c) => ({ id: c.id, estudianteId: c.estudiante_id! })), "instructor"),
    nombresEstudiantes([...new Set(filas.map((c) => c.estudiante_id!))]),
  ]);
  return filas.map((c) => {
    const ultimo = ultimoMensaje(c);
    return {
      id: c.id,
      cursoId: c.curso_id,
      curso: uno<{ titulo: string }>(c.curso)?.titulo ?? "Curso",
      otro: estudiantes.get(c.estudiante_id!) || "Estudiante",
      ultimoMensaje: ultimo?.texto ?? null,
      ultimoEn: ultimo?.enviado_en ?? c.ultimo_mensaje_en,
      noLeidos: noLeidos.get(c.id) ?? 0,
    };
  });
}

/** Una conversación con sus mensajes (los 500 últimos), si el usuario participa en ella (RLS). */
export async function obtenerConversacion(
  filtro: { cursoId: string; estudianteId: string } | { id: number },
  usuarioId: string,
): Promise<{ id: number; cursoId: string; curso: string; otro: string; mensajes: Mensaje[] } | null> {
  const supabase = await createClient();
  let consulta = supabase.from("conversaciones").select("id, curso_id, estudiante_id, curso:cursos(titulo, instructor_id)");
  consulta = "id" in filtro ? consulta.eq("id", filtro.id) : consulta.eq("curso_id", filtro.cursoId).eq("estudiante_id", filtro.estudianteId);
  const { data: c } = await consulta.maybeSingle();
  if (!c) return null;
  const curso = uno<{ titulo: string; instructor_id: string | null }>(c.curso);

  const soyEstudiante = c.estudiante_id === usuarioId;
  const [{ data: mensajes }, otro] = await Promise.all([
    supabase.from("mensajes").select("id, texto, enviado_en, autor_id, leido_en").eq("conversacion_id", c.id).order("enviado_en", { ascending: false }).limit(500),
    soyEstudiante
      ? nombresInstructores(supabase, curso?.instructor_id ? [curso.instructor_id] : []).then((n) => (curso?.instructor_id && n.get(curso.instructor_id)) || "Instructor")
      : nombresEstudiantes([c.estudiante_id]).then((n) => n.get(c.estudiante_id) || "Estudiante"),
  ]);
  return {
    id: c.id,
    cursoId: c.curso_id,
    curso: curso?.titulo ?? "Curso",
    otro,
    // La BD entrega los 500 más recientes primero; se muestran en orden cronológico.
    mensajes: (mensajes ?? [])
      .map((m) => ({ id: m.id, texto: m.texto, enviadoEn: m.enviado_en, propio: esDelEstudiante(m.autor_id, c.estudiante_id) === soyEstudiante, leido: Boolean(m.leido_en) }))
      .reverse(),
  };
}
