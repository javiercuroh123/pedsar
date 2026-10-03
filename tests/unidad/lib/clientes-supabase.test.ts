import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { describe, expect, it, vi } from "vitest";

// Este archivo prueba las fábricas reales de clientes (las demás pruebas usan el cliente simulado).
vi.unmock("@/lib/supabase/server");
vi.unmock("@/lib/supabase/admin");

const ssr = vi.hoisted(() => ({ claims: null as Record<string, unknown> | null, opciones: [] as { cookies: Record<string, (...a: never[]) => unknown> }[] }));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn((_url: string, _clave: string, opciones: (typeof ssr.opciones)[number]) => {
    ssr.opciones.push(opciones);
    return { auth: { getClaims: async () => ({ data: ssr.claims ? { claims: ssr.claims } : null }) } };
  }),
  createBrowserClient: vi.fn(() => ({ navegador: true })),
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn(() => ({ admin: true })) }));

const { createServerClient, createBrowserClient } = await import("@supabase/ssr");
const { createClient: createSupabaseClient } = await import("@supabase/supabase-js");

describe("fábricas de clientes de Supabase", () => {
  it("el cliente de servidor usa la clave pública y las cookies de la petición", async () => {
    const set = vi.fn();
    vi.mocked(cookies).mockResolvedValueOnce({ getAll: () => [{ name: "sb", value: "1" }], set } as never);
    const { createClient } = await import("@/lib/supabase/server");
    await createClient();
    expect(createServerClient).toHaveBeenCalledWith("http://127.0.0.1:54321", "clave-publica-de-prueba", expect.anything());
    const { cookies: adaptador } = ssr.opciones.at(-1)!;
    expect(adaptador.getAll()).toEqual([{ name: "sb", value: "1" }]);
    adaptador.setAll([{ name: "sb", value: "2", options: {} }] as never);
    expect(set).toHaveBeenCalledWith("sb", "2", {});
  });

  it("desde un Server Component ignora el error al escribir cookies", async () => {
    vi.mocked(cookies).mockResolvedValueOnce({
      getAll: () => [],
      set: () => {
        throw new Error("solo lectura");
      },
    } as never);
    const { createClient } = await import("@/lib/supabase/server");
    await createClient();
    expect(() => ssr.opciones.at(-1)!.cookies.setAll([{ name: "a", value: "b", options: {} }] as never)).not.toThrow();
  });

  it("el cliente del navegador y el admin usan sus claves", async () => {
    const { createClient: navegador } = await import("@/lib/supabase/client");
    expect(navegador()).toEqual({ navegador: true });
    expect(createBrowserClient).toHaveBeenCalledWith("http://127.0.0.1:54321", "clave-publica-de-prueba");

    const { createAdminClient } = await import("@/lib/supabase/admin");
    expect(createAdminClient()).toEqual({ admin: true });
    expect(createSupabaseClient).toHaveBeenCalledWith("http://127.0.0.1:54321", "clave-secreta-de-prueba", {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  });

  it("el cliente admin exige SUPABASE_SECRET_KEY", async () => {
    vi.stubEnv("SUPABASE_SECRET_KEY", "");
    vi.resetModules();
    try {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      expect(() => createAdminClient()).toThrow(/Falta SUPABASE_SECRET_KEY/);
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });
});

describe("proxy: sesión y rutas protegidas", () => {
  const pedir = async (ruta: string, claims: Record<string, unknown> | null) => {
    ssr.claims = claims;
    const { proxy, config } = await import("@/proxy");
    expect(config.matcher[0]).toContain("api/pagos/webhook");
    return proxy(new NextRequest(`https://pedsar.test${ruta}`));
  };

  it("sin sesión, una ruta privada redirige al login recordando el destino", async () => {
    const r = await pedir("/certificados/PED-2026-ABCDEFGH/pdf", null);
    expect(r.status).toBe(307);
    expect(r.headers.get("location")).toBe("https://pedsar.test/login?next=%2Fcertificados%2FPED-2026-ABCDEFGH%2Fpdf");
  });

  it("deja pasar las rutas públicas y las privadas con sesión, refrescando las cookies", async () => {
    expect((await pedir("/cursos", null)).status).toBe(200);
    const r = await pedir("/admin/reportes", { sub: "usuario" });
    expect(r.status).toBe(200);
    ssr.opciones.at(-1)!.cookies.setAll([{ name: "sb-token", value: "nuevo", options: { path: "/" } }] as never);
    expect(ssr.opciones.at(-1)!.cookies.getAll()).toEqual([{ name: "sb-token", value: "nuevo" }]);
  });
});

describe("variables de entorno", () => {
  it("rechaza una URL de Supabase inválida al arrancar", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "no-es-una-url");
    vi.resetModules();
    try {
      await expect(import("@/lib/env")).rejects.toThrow();
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });

  it.each([
    ["production", "https://pedsar.vercel.app"],
    ["preview", "https://pedsar-git-fase-4.vercel.app"],
  ])("en Vercel (%s) usa su dominio si no hay NEXT_PUBLIC_SITE_URL", async (ambiente, url) => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_VERCEL_ENV", ambiente);
    vi.stubEnv("NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL", "pedsar.vercel.app");
    vi.stubEnv("NEXT_PUBLIC_VERCEL_BRANCH_URL", "pedsar-git-fase-4.vercel.app");
    vi.resetModules();
    try {
      expect((await import("@/lib/env")).publicEnv.NEXT_PUBLIC_SITE_URL).toBe(url);
      vi.stubEnv("NEXT_PUBLIC_VERCEL_BRANCH_URL", "");
      vi.stubEnv("NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL", "");
      vi.resetModules();
      expect((await import("@/lib/env")).publicEnv.NEXT_PUBLIC_SITE_URL).toBe("http://localhost:3000");
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });

  it("los opcionales vacíos quedan sin definir y hay valores por defecto", async () => {
    vi.stubEnv("NEXT_PUBLIC_GA_ID", "");
    vi.stubEnv("PAYMENT_PROVIDER", "");
    vi.stubEnv("EMAIL_FROM", undefined as unknown as string);
    vi.resetModules();
    try {
      const { publicEnv } = await import("@/lib/env");
      expect(publicEnv.NEXT_PUBLIC_GA_ID).toBeUndefined();
      expect(publicEnv.NEXT_PUBLIC_SITE_URL).toBe("https://pedsar.test");
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });
});

describe("monitoreo con Sentry", () => {
  it("solo se inicia si hay DSN", async () => {
    const init = vi.fn();
    vi.doMock("@sentry/nextjs", () => ({ init, captureRequestError: vi.fn() }));
    vi.resetModules();
    try {
      const { register } = await import("@/instrumentation");
      await register();
      expect(init).not.toHaveBeenCalled();
      vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://clave@o0.ingest.sentry.io/1");
      vi.stubEnv("VERCEL_ENV", "preview");
      await register();
      expect(init).toHaveBeenCalledWith(expect.objectContaining({ dsn: "https://clave@o0.ingest.sentry.io/1", environment: "preview" }));
    } finally {
      vi.doUnmock("@sentry/nextjs");
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });
});
