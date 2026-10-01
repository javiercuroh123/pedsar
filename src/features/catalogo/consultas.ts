import "server-only";
import { createClient } from "@/lib/supabase/server";
import { hoyISO, nombreCompleto } from "@/lib/formato";
import type { Modalidad, Nivel } from "@/types/dominio";

export interface CursoResumen {
  id: string;
  slug: string;
  titulo: string;
  descripcion: string | null;
  imagen_url: string | null;
  nivel: Nivel;
  modalidad: Modalidad;
  precio: number;
  duracion_horas: number;
  cupo_maximo: number;
  destacado: boolean;
  categoria: { nombre: string; slug: string } | null;
  instructor: string | null;
  cupo_disponible: number;
  proxima_sesion: { fecha: string; hora_inicio: string } | null;
}

export type OrdenCatalogo = "relevancia" | "inicio" | "precio-asc" | "precio-desc";

export interface FiltrosCatalogo {
  q?: string;
  categorias?: string[];
  niveles?: Nivel[];
  modalidades?: Modalidad[];
  precioMax?: number;
  orden?: OrdenCatalogo;
  destacados?: boolean;
  limite?: number;
}

const CAMPOS_RESUMEN =
  "id, slug, titulo, descripcion, imagen_url, nivel, modalidad, precio, duracion_horas, cupo_maximo, destacado, instructor_id, sesiones(fecha, hora_inicio)";

const normalizar = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

type FilaSesion = { fecha: string; hora_inicio: string };

/** Nombres públicos de instructores (la tabla perfiles no es legible por visitantes). */
async function nombresInstructores(ids: string[]) {
  const unicos = [...new Set(ids.filter(Boolean))];
  if (!unicos.length) return new Map<string, string>();
  const supabase = await createClient();
  const { data } = await supabase.from("instructores_publicos").select("id, nombres, apellidos").in("id", unicos);
  return new Map((data ?? []).map((i: { id: string; nombres: string; apellidos: string }) => [i.id, nombreCompleto(i)]));
}

function proximaSesion(sesiones: FilaSesion[] | null) {
  const hoy = hoyISO();
  return (
    [...(sesiones ?? [])]
      .filter((s) => s.fecha >= hoy)
      .sort((a, b) => (a.fecha + a.hora_inicio).localeCompare(b.fecha + b.hora_inicio))[0] ?? null
  );
}

// HU-05 / HU-33 · Catálogo con filtros y búsqueda por nombre o instructor
export async function listarCursosPublicados(filtros: FiltrosCatalogo = {}): Promise<CursoResumen[]> {
  const supabase = await createClient();
  // !inner solo al filtrar por categoría; si no, se incluyen cursos sin categoría.
  const joinCategoria = filtros.categorias?.length ? "categorias!inner" : "categorias";
  let consulta = supabase
    .from("cursos")
    .select(`${CAMPOS_RESUMEN}, categoria:${joinCategoria}(nombre, slug)`)
    .eq("estado", "PUBLICADO")
    .order("destacado", { ascending: false })
    .order("creado_en", { ascending: false });

  if (filtros.categorias?.length) consulta = consulta.in("categoria.slug", filtros.categorias);
  if (filtros.niveles?.length) consulta = consulta.in("nivel", filtros.niveles);
  if (filtros.modalidades?.length) consulta = consulta.in("modalidad", filtros.modalidades);
  if (filtros.precioMax !== undefined) consulta = consulta.lte("precio", filtros.precioMax);
  if (filtros.destacados) consulta = consulta.eq("destacado", true);

  const { data, error } = await consulta;
  if (error) throw new Error(`Catálogo: ${error.message}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filas = (data ?? []) as any[];
  const [instructores, cupos] = await Promise.all([
    nombresInstructores(filas.map((f) => f.instructor_id)),
    Promise.all(filas.map((f) => supabase.rpc("cupo_disponible", { p_curso: f.id }))),
  ]);

  let cursos: CursoResumen[] = filas.map((f, i) => ({
    id: f.id,
    slug: f.slug,
    titulo: f.titulo,
    descripcion: f.descripcion,
    imagen_url: f.imagen_url,
    nivel: f.nivel,
    modalidad: f.modalidad,
    precio: Number(f.precio),
    duracion_horas: f.duracion_horas,
    cupo_maximo: f.cupo_maximo,
    destacado: f.destacado,
    categoria: f.categoria ?? null,
    instructor: instructores.get(f.instructor_id) ?? null,
    cupo_disponible: (cupos[i].data as number | null) ?? f.cupo_maximo,
    proxima_sesion: proximaSesion(f.sesiones),
  }));

  if (filtros.q) {
    const q = normalizar(filtros.q);
    cursos = cursos.filter((c) =>
      normalizar(`${c.titulo} ${c.descripcion ?? ""} ${c.instructor ?? ""} ${c.categoria?.nombre ?? ""}`).includes(q),
    );
  }

  const orden = filtros.orden ?? "relevancia";
  if (orden === "precio-asc") cursos.sort((a, b) => a.precio - b.precio);
  if (orden === "precio-desc") cursos.sort((a, b) => b.precio - a.precio);
  if (orden === "inicio")
    cursos.sort((a, b) => (a.proxima_sesion?.fecha ?? "9999").localeCompare(b.proxima_sesion?.fecha ?? "9999"));

  return filtros.limite ? cursos.slice(0, filtros.limite) : cursos;
}

// HU-06 · Detalle de curso
export async function obtenerCursoPorSlug(slug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cursos")
    .select(
      `id, slug, titulo, descripcion, imagen_url, nivel, modalidad, precio, cupo_maximo, duracion_horas, destacado, instructor_id,
       categoria:categorias(nombre, slug),
       modulos(id, titulo, orden),
       sesiones(id, fecha, hora_inicio, duracion_minutos, modalidad)`,
    )
    .eq("slug", slug)
    .eq("estado", "PUBLICADO")
    .maybeSingle();
  if (error) throw new Error(`Curso: ${error.message}`);
  if (!data) return null;

  const [{ data: cupo }, { data: instructor }] = await Promise.all([
    supabase.rpc("cupo_disponible", { p_curso: data.id }),
    data.instructor_id
      ? supabase
          .from("instructores_publicos")
          .select("nombres, apellidos, especialidad, avatar_url")
          .eq("id", data.instructor_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    ...data,
    nivel: data.nivel as Nivel,
    modalidad: data.modalidad as Modalidad,
    // PostgREST devuelve un objeto en relaciones muchos-a-uno, aunque el tipo inferido sea un arreglo.
    categoria: data.categoria as unknown as { nombre: string; slug: string } | null,
    precio: Number(data.precio),
    cupo_disponible: (cupo as number | null) ?? 0,
    instructor: instructor as { nombres: string; apellidos: string; especialidad: string | null; avatar_url: string | null } | null,
    modulos: [...((data.modulos ?? []) as { id: number; titulo: string; orden: number }[])].sort((a, b) => a.orden - b.orden),
    sesiones: [
      ...((data.sesiones ?? []) as { id: number; fecha: string; hora_inicio: string; duracion_minutos: number; modalidad: Modalidad }[]),
    ].sort((a, b) => (a.fecha + a.hora_inicio).localeCompare(b.fecha + b.hora_inicio)),
  };
}

export type CursoDetalle = NonNullable<Awaited<ReturnType<typeof obtenerCursoPorSlug>>>;

// HU-18 · Categorías
export async function listarCategorias() {
  const supabase = await createClient();
  const { data } = await supabase.from("categorias").select("id, nombre, slug, descripcion").order("nombre");
  return (data ?? []) as { id: number; nombre: string; slug: string; descripcion: string | null }[];
}
