import { afterEach, beforeEach, vi } from "vitest";
import { reiniciarEntorno } from "./apoyo/entorno";

/**
 * Simulacros comunes a todas las pruebas unitarias: las APIs de Next.js que solo
 * existen dentro de una petición y los clientes de Supabase (ver apoyo/entorno.ts).
 */
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

vi.mock("next/navigation", async () => {
  const { Redireccion } = await import("./apoyo/entorno");
  return {
    redirect: vi.fn((destino: string) => {
      throw new Redireccion(destino);
    }),
  };
});

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" })),
  cookies: vi.fn(async () => ({ getAll: () => [], set: vi.fn() })),
}));

vi.mock("next/server", async (importOriginal) => {
  const real = await importOriginal<typeof import("next/server")>();
  const { entorno } = await import("./apoyo/entorno");
  return { ...real, after: vi.fn((tarea: () => unknown) => void entorno.tareas.push(tarea)) };
});

vi.mock("@/lib/supabase/server", async () => {
  const { entorno } = await import("./apoyo/entorno");
  return { createClient: vi.fn(async () => entorno.servidor.cliente) };
});

vi.mock("@/lib/supabase/admin", async () => {
  const { entorno } = await import("./apoyo/entorno");
  return { createAdminClient: vi.fn(() => entorno.admin.cliente) };
});

beforeEach(() => {
  reiniciarEntorno();
  vi.clearAllMocks();
  // Los correos simulados y los errores controlados no ensucian la salida; se pueden comprobar con expect(console.*).
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
