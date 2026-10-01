import { vi } from "vitest";

/** Una consulta hecha al cliente simulado, para poder comprobar qué se leyó o escribió. */
export interface Consulta {
  /** Tabla, o `rpc:nombre` para las funciones. */
  tabla: string;
  operacion: "select" | "insert" | "update" | "upsert" | "delete" | "rpc";
  columnas?: string;
  opciones?: unknown;
  valores?: unknown;
  /** Filtros y modificadores en orden: ["eq", "id", "…"], ["order", "fecha"], … */
  filtros: unknown[][];
  modo?: "single" | "maybeSingle";
}

export interface Respuesta {
  data?: unknown;
  error?: { code?: string; message: string } | null;
  count?: number | null;
}

/**
 * Cómo responder a una tabla: una respuesta fija, una función de la consulta o
 * una lista que se consume en orden (una respuesta por consulta).
 */
export type Manejador = Respuesta | ((c: Consulta) => Respuesta | undefined) | Respuesta[];

const FILTROS = ["eq", "neq", "in", "gt", "gte", "lt", "lte", "is", "like", "ilike", "match", "not", "or", "filter", "contains", "order", "limit", "range"];

/**
 * Cliente de Supabase simulado. Las respuestas se buscan por `tabla.operacion`
 * (p. ej. "pagos.update") y, si no hay, por `tabla`; sin manejador devuelve
 * `{ data: null, error: null }`. Todas las consultas quedan en `consultas`.
 */
export function supabaseFalso(manejadores: Record<string, Manejador> = {}) {
  const consultas: Consulta[] = [];
  const colas = new Map<string, Manejador>(Object.entries(manejadores).map(([k, v]) => [k, Array.isArray(v) ? [...v] : v]));

  const responder = (c: Consulta) => {
    const clave = colas.has(`${c.tabla}.${c.operacion}`) ? `${c.tabla}.${c.operacion}` : c.tabla;
    const m = colas.get(clave);
    const r = Array.isArray(m) ? m.shift() : typeof m === "function" ? m(c) : m;
    return { data: null, error: null, count: null, status: 200, ...r };
  };

  function consulta(tabla: string, operacion: Consulta["operacion"] = "select", valores?: unknown) {
    const c: Consulta = { tabla, operacion, valores, filtros: [] };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const q: any = {
      select(columnas?: string, opciones?: unknown) {
        if (c.operacion === "select") {
          c.columnas = columnas;
          c.opciones = opciones;
        } else c.filtros.push(["select", columnas]);
        return q;
      },
      insert(v: unknown) {
        Object.assign(c, { operacion: "insert", valores: v });
        return q;
      },
      update(v: unknown) {
        Object.assign(c, { operacion: "update", valores: v });
        return q;
      },
      upsert(v: unknown, opciones?: unknown) {
        Object.assign(c, { operacion: "upsert", valores: v, opciones });
        return q;
      },
      delete() {
        c.operacion = "delete";
        return q;
      },
      single() {
        c.modo = "single";
        return q;
      },
      maybeSingle() {
        c.modo = "maybeSingle";
        return q;
      },
      then(resolver: (v: unknown) => unknown, rechazar?: (e: unknown) => unknown) {
        consultas.push(c);
        return Promise.resolve().then(() => responder(c)).then(resolver, rechazar);
      },
    };
    for (const f of FILTROS) {
      q[f] = (...args: unknown[]) => {
        c.filtros.push([f, ...args]);
        return q;
      };
    }
    return q;
  }

  const ok = <T,>(data: T) => vi.fn(async () => ({ data, error: null }));
  const cliente = {
    from: (tabla: string) => consulta(tabla),
    rpc: (nombre: string, args?: unknown) => consulta(`rpc:${nombre}`, "rpc", args),
    auth: {
      getClaims: ok<{ claims: Record<string, unknown> } | null>(null),
      signInWithPassword: ok({ user: { id: "usuario" } }),
      signUp: ok({ user: null }),
      signOut: ok(null),
      resetPasswordForEmail: ok({}),
      updateUser: ok({ user: null }),
      verifyOtp: ok({}),
      admin: { inviteUserByEmail: ok({ user: { id: "invitado" } }) },
    },
  };

  return {
    cliente,
    consultas,
    /** Consultas a una tabla (opcionalmente de una operación). */
    de: (tabla: string, operacion?: Consulta["operacion"]) =>
      consultas.filter((c) => c.tabla === tabla && (!operacion || c.operacion === operacion)),
  };
}

export type SupabaseFalso = ReturnType<typeof supabaseFalso>;
