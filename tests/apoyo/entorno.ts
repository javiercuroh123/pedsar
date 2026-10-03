import type { Perfil, Rol } from "@/types/dominio";
import { supabaseFalso, type Manejador, type SupabaseFalso } from "./supabase-falso";

/**
 * Estado compartido entre los simulacros de tests/setup.ts y cada prueba:
 * los clientes de Supabase (con sesión y admin), el usuario con sesión y las
 * tareas programadas con `after()` (correos).
 */
export const entorno: {
  servidor: SupabaseFalso;
  admin: SupabaseFalso;
  usuario: Perfil | null;
  tareas: (() => unknown)[];
} = { servidor: supabaseFalso(), admin: supabaseFalso(), usuario: null, tareas: [] };

export function reiniciarEntorno() {
  entorno.servidor = supabaseFalso();
  entorno.admin = supabaseFalso();
  entorno.usuario = null;
  entorno.tareas = [];
}

/** Configura las respuestas del cliente con sesión (RLS) y del cliente admin. */
export function responder(servidor: Record<string, Manejador> = {}, admin: Record<string, Manejador> = {}) {
  entorno.servidor = supabaseFalso(servidor);
  entorno.admin = supabaseFalso(admin);
  return { servidor: entorno.servidor, admin: entorno.admin };
}

/** Ejecuta las tareas que se dejaron para después de responder (`after`). */
export async function ejecutarTareas() {
  for (const tarea of entorno.tareas.splice(0)) await tarea();
}

export const UUID = {
  estudiante: "11111111-1111-4111-8111-111111111111",
  instructor: "22222222-2222-4222-8222-222222222222",
  admin: "33333333-3333-4333-8333-333333333333",
  curso: "44444444-4444-4444-8444-444444444444",
  inscripcion: "55555555-5555-4555-8555-555555555555",
  pago: "66666666-6666-4666-8666-666666666666",
  otra: "77777777-7777-4777-8777-777777777777",
};

const ID_POR_ROL: Record<Rol, string> = { estudiante: UUID.estudiante, instructor: UUID.instructor, administrador: UUID.admin };

export const perfil = (rol: Rol, extra: Partial<Perfil> = {}): Perfil => ({
  id: ID_POR_ROL[rol],
  nombres: "Ana",
  apellidos: "Quispe Rojas",
  correo: `${rol}@pedsar.test`,
  rol,
  especialidad: null,
  avatar_url: null,
  estado: true,
  ...extra,
});

/** Inicia sesión con un rol en las acciones que usan el simulacro de @/lib/auth. */
export const conSesion = (rol: Rol, extra: Partial<Perfil> = {}) => (entorno.usuario = perfil(rol, extra));

/** Lo que lanza redirect() en Next.js; las pruebas comprueban el destino. */
export class Redireccion extends Error {
  constructor(public destino: string) {
    super(`NEXT_REDIRECT ${destino}`);
  }
}

export function formulario(datos: Record<string, string | number | string[] | undefined>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(datos)) {
    if (v === undefined) continue;
    for (const valor of Array.isArray(v) ? v : [v]) fd.append(k, String(valor));
  }
  return fd;
}
