import "server-only";
import { uno } from "@/features/academico/consultas";
import { nombreCompleto } from "@/lib/formato";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export interface RespuestaForo {
  id: number;
  texto: string;
  creadoEn: string;
  autorNombre: string;
  esInstructor: boolean;
  propio: boolean;
}

export interface TemaForo {
  id: number;
  cursoId: string;
  contenidoId: number | null;
  contenidoTitulo: string | null;
  titulo: string;
  cuerpo: string;
  resuelto: boolean;
  creadoEn: string;
  autorNombre: string;
  esInstructor: boolean;
  propio: boolean;
  puedeResolver: boolean;
  respuestas: RespuestaForo[];
}

type FilaRespuesta = {
  id: number;
  autor_id: string;
  texto: string;
  creado_en: string;
};

type FilaTema = {
  id: number;
  curso_id: string;
  contenido_id: number | null;
  autor_id: string;
  titulo: string;
  cuerpo: string;
  resuelto: boolean;
  creado_en: string;
  contenido?: unknown;
  curso?: unknown;
  foro_respuestas?: FilaRespuesta[] | null;
};

/**
 * HU-22 · HU-23 · Lista los temas del foro general del curso y las preguntas por lección
 * con sus respuestas. La RLS garantiza que solo participen inscritos confirmados, el
 * instructor del curso o administradores.
 */
export async function listarTemasCurso(cursoId: string, usuarioId: string, esGestor = false): Promise<TemaForo[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("foro_temas")
    .select(
      "id, curso_id, contenido_id, autor_id, titulo, cuerpo, resuelto, creado_en, contenido:contenidos(titulo), curso:cursos(instructor_id), foro_respuestas(id, autor_id, texto, creado_en)",
    )
    .eq("curso_id", cursoId)
    .order("creado_en", { ascending: false })
    .limit(200);

  const filas = (data ?? []) as FilaTema[];
  if (!filas.length) return [];

  const autorIds = [
    ...new Set(filas.flatMap((t) => [t.autor_id, ...(t.foro_respuestas ?? []).map((r) => r.autor_id)])),
  ];
  const { data: perfiles } = await createAdminClient()
    .from("perfiles")
    .select("id, nombres, apellidos, rol")
    .in("id", autorIds);
  const mapaAutores = new Map(
    (perfiles ?? []).map((p) => [p.id, { nombre: nombreCompleto(p) || "Participante", rol: p.rol }]),
  );

  return filas.map((t) => {
    const instructorId = uno<{ instructor_id: string | null }>(t.curso)?.instructor_id ?? null;
    const autorTema = mapaAutores.get(t.autor_id);
    const esDocente = (autorId: string, rol?: string) =>
      autorId === instructorId || rol === "instructor" || rol === "administrador";
    const respuestas = [...(t.foro_respuestas ?? [])]
      .sort((a, b) => a.creado_en.localeCompare(b.creado_en))
      .map((r) => {
        const autorResp = mapaAutores.get(r.autor_id);
        return {
          id: r.id,
          texto: r.texto,
          creadoEn: r.creado_en,
          autorNombre: autorResp?.nombre ?? "Participante",
          esInstructor: esDocente(r.autor_id, autorResp?.rol),
          propio: r.autor_id === usuarioId,
        };
      });

    return {
      id: t.id,
      cursoId: t.curso_id,
      contenidoId: t.contenido_id,
      contenidoTitulo: uno<{ titulo: string }>(t.contenido)?.titulo ?? null,
      titulo: t.titulo,
      cuerpo: t.cuerpo,
      resuelto: t.resuelto,
      creadoEn: t.creado_en,
      autorNombre: autorTema?.nombre ?? "Participante",
      esInstructor: esDocente(t.autor_id, autorTema?.rol),
      propio: t.autor_id === usuarioId,
      puedeResolver: t.autor_id === usuarioId || instructorId === usuarioId || esGestor,
      respuestas,
    };
  });
}
