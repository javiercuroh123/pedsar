import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { nombreCompleto } from "@/lib/formato";
import type { EstadoCurso, Modalidad, Perfil } from "@/types/dominio";
import { uno } from "./consultas";

export interface CursoInstructor {
  id: string;
  slug: string;
  titulo: string;
  estado: EstadoCurso;
  modalidad: Modalidad;
  cupo_maximo: number;
  categoria: { slug: string; nombre: string } | null;
}

/** Cursos a cargo del instructor (el administrador ve todos desde el portal del instructor). */
export async function listarCursosDelInstructor(usuario: Perfil): Promise<CursoInstructor[]> {
  const supabase = await createClient();
  let consulta = supabase
    .from("cursos")
    .select("id, slug, titulo, estado, modalidad, cupo_maximo, categoria:categorias(slug, nombre)")
    .order("creado_en", { ascending: false });
  if (usuario.rol !== "administrador") consulta = consulta.eq("instructor_id", usuario.id);
  const { data } = await consulta;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((c) => ({ ...c, categoria: uno(c.categoria) }));
}

/** Curso elegido en la URL (?curso=) o el primero de la lista. */
export function elegirCurso(cursos: CursoInstructor[], param: string | string[] | undefined) {
  return cursos.find((c) => c.id === param) ?? cursos[0] ?? null;
}

export interface EstudianteCurso {
  inscripcionId: string;
  estudianteId: string;
  nombre: string;
  correo: string;
  /** Contacto para el reporte del instructor (HU-42). */
  telefono: string | null;
  avatar: string | null;
}

/**
 * Estudiantes confirmados de un curso. Los perfiles no son legibles por el
 * instructor (RLS), así que se leen con el cliente admin SOLO después de que
 * el llamador comprobó que el curso le pertenece (listarCursosDelInstructor).
 */
export async function listarEstudiantesDelCurso(cursoId: string): Promise<EstudianteCurso[]> {
  const { data } = await createAdminClient()
    .from("inscripciones")
    .select("id, estudiante:perfiles(id, nombres, apellidos, correo, telefono, avatar_url)")
    .eq("curso_id", cursoId)
    .eq("estado", "CONFIRMADA");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[])
    .map((i) => {
      const e = uno<{ id: string; nombres: string; apellidos: string; correo: string; telefono: string | null; avatar_url: string | null }>(i.estudiante)!;
      return {
        inscripcionId: i.id,
        estudianteId: e.id,
        nombre: nombreCompleto(e) || e.correo,
        correo: e.correo,
        telefono: e.telefono,
        avatar: e.avatar_url,
      };
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

export interface SesionCurso {
  id: number;
  curso_id: string;
  fecha: string;
  hora_inicio: string;
  duracion_minutos: number;
  modalidad: Modalidad;
  enlace_virtual: string | null;
}

export async function listarSesionesDeCursos(cursoIds: string[]): Promise<SesionCurso[]> {
  if (!cursoIds.length) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("sesiones")
    .select("id, curso_id, fecha, hora_inicio, duracion_minutos, modalidad, enlace_virtual")
    .in("curso_id", cursoIds)
    .order("fecha")
    .order("hora_inicio");
  return (data ?? []) as SesionCurso[];
}
