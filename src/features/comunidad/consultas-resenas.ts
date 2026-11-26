import "server-only";
import { uno } from "@/features/academico/consultas";
import { calificaciones } from "@/features/catalogo/consultas";
import { nombreCompleto } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";

/** La reseña del estudiante en el aula; si está oculta, la sigue viendo con la marca de moderación. */
export interface ResenaPropia {
  estrellas: number;
  texto: string | null;
  oculta: boolean;
}

/** Una reseña en la página de moderación del administrador. */
export interface ResenaAdmin {
  id: number;
  curso: string;
  estudiante: string;
  estrellas: number;
  texto: string | null;
  oculta: boolean;
  fecha: string;
}

export interface CursoEvaluado {
  id: string;
  titulo: string;
  promedio: number;
  cantidad: number;
}

/**
 * HU-24 · Reseña propia de una inscripción y si ya tiene certificado (con el 100 % de avance,
 * decide si el aula ofrece calificar). La BD vuelve a verificar la elegibilidad al guardar.
 */
export async function datosResenaPropia(inscripcionId: string): Promise<{ resena: ResenaPropia | null; certificado: boolean }> {
  const supabase = await createClient();
  const [{ data: resena }, { data: certificado }] = await Promise.all([
    supabase.from("resenas").select("estrellas, texto, oculta").eq("inscripcion_id", inscripcionId).maybeSingle(),
    supabase.from("certificados").select("id").eq("inscripcion_id", inscripcionId).maybeSingle(),
  ]);
  return { resena: resena ?? null, certificado: !!certificado };
}

/** Moderación: todas las reseñas (visibles y ocultas), de la más reciente a la más antigua. RLS: solo el administrador. */
export async function listarResenasAdmin(): Promise<ResenaAdmin[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("resenas")
    .select("id, estrellas, texto, oculta, actualizada_en, curso:cursos(titulo), estudiante:perfiles(nombres, apellidos)")
    .order("actualizada_en", { ascending: false })
    .limit(300);
  return (data ?? []).map((r) => ({
    id: r.id,
    curso: uno<{ titulo: string }>(r.curso)?.titulo ?? "—",
    estudiante: nombreCompleto(uno<{ nombres: string; apellidos: string }>(r.estudiante)),
    estrellas: r.estrellas,
    texto: r.texto,
    oculta: r.oculta,
    fecha: r.actualizada_en,
  }));
}

/** HU-20 · Cursos con mejor promedio (desempata la cantidad de reseñas); las reseñas ocultas no cuentan. */
export async function cursosMejorEvaluados(limite = 5): Promise<CursoEvaluado[]> {
  const supabase = await createClient();
  const { data: cursos } = await supabase.from("cursos").select("id, titulo");
  const lista = (cursos ?? []) as { id: string; titulo: string }[];
  if (!lista.length) return [];
  const notas = await calificaciones(lista.map((c) => c.id));
  return lista
    .flatMap((c) => {
      const n = notas.get(c.id);
      return n ? [{ id: c.id, titulo: c.titulo, ...n }] : [];
    })
    .sort((a, b) => b.promedio - a.promedio || b.cantidad - a.cantidad)
    .slice(0, limite);
}

/** HU-46 · Un testimonio de la página de inicio: una reseña real visible, con el autor abreviado. */
export interface Testimonio {
  estrellas: number;
  texto: string;
  autor: string;
  curso: string;
  cursoSlug: string;
}

/**
 * HU-46 · Testimonios para la página de inicio: reseñas visibles de 4–5 estrellas con texto,
 * de cursos publicados y una por estudiante (lo filtra la BD). Si falla, la sección no se muestra.
 */
export async function listarTestimonios(limite = 3): Promise<Testimonio[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("testimonios_publicos", { p_limite: limite });
  if (error) return [];
  return (data ?? []).map((t) => ({ estrellas: t.estrellas, texto: t.texto, autor: t.autor, curso: t.curso, cursoSlug: t.curso_slug }));
}
