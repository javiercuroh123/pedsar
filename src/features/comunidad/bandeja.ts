import type { ConversacionResumen } from "./consultas";

/** HU-52 · Filtros de la bandeja del instructor, leídos de la URL (?curso=&estudiante=&estado=). */
export type EstadoBandeja = "sin-leer" | "leidos";
export interface FiltrosBandeja {
  curso?: string;
  estudiante?: string;
  estado?: EstadoBandeja;
}

export const ESTADOS_BANDEJA: { valor: EstadoBandeja; etiqueta: string }[] = [
  { valor: "sin-leer", etiqueta: "Sin leer" },
  { valor: "leidos", etiqueta: "Leídos" },
];

const texto = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : undefined);

/**
 * Solo acepta valores que existen: un curso del instructor, un estudiante con
 * conversación en ese curso (o en cualquiera si no hay curso) y un estado conocido.
 */
export function leerFiltrosBandeja(
  params: Record<string, string | string[] | undefined>,
  items: ConversacionResumen[],
  cursosDelInstructor: string[],
): FiltrosBandeja {
  const curso = texto(params.curso);
  const estudiante = texto(params.estudiante);
  const estado = texto(params.estado);
  const f: FiltrosBandeja = {};
  if (curso && cursosDelInstructor.includes(curso)) f.curso = curso;
  if (estudiante && estudiantesDeBandeja(items, f.curso).some((e) => e.id === estudiante)) f.estudiante = estudiante;
  if (ESTADOS_BANDEJA.some((e) => e.valor === estado)) f.estado = estado as EstadoBandeja;
  return f;
}

export function filtrarBandeja(items: ConversacionResumen[], f: FiltrosBandeja): ConversacionResumen[] {
  return items.filter(
    (c) =>
      (!f.curso || c.cursoId === f.curso) &&
      (!f.estudiante || c.estudianteId === f.estudiante) &&
      (!f.estado || (f.estado === "sin-leer" ? c.noLeidos > 0 : c.noLeidos === 0)),
  );
}

/** Mensajes sin leer por curso (solo los cursos que tienen alguno). */
export function noLeidosPorCurso(items: ConversacionResumen[]): Map<string, number> {
  const cuenta = new Map<string, number>();
  for (const c of items) if (c.noLeidos > 0) cuenta.set(c.cursoId, (cuenta.get(c.cursoId) ?? 0) + c.noLeidos);
  return cuenta;
}

/** Estudiantes con conversación (en un curso o en todos), sin repetir y por nombre. */
export function estudiantesDeBandeja(items: ConversacionResumen[], curso?: string): { id: string; nombre: string }[] {
  const vistos = new Map<string, string>();
  for (const c of items) if (c.estudianteId && (!curso || c.cursoId === curso)) vistos.set(c.estudianteId, c.otro);
  return [...vistos].map(([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

/**
 * HU-63 · Resumen para el panel de inicio (estudiante o instructor): total de
 * mensajes sin leer y las conversaciones que los tienen, las más recientes primero.
 */
export function resumenSinLeer(items: ConversacionResumen[], max = 3): { total: number; conversaciones: ConversacionResumen[] } {
  const conPendientes = items.filter((c) => c.noLeidos > 0).sort((a, b) => (b.ultimoEn ?? "").localeCompare(a.ultimoEn ?? ""));
  return { total: conPendientes.reduce((a, c) => a + c.noLeidos, 0), conversaciones: conPendientes.slice(0, max) };
}
