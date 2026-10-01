import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const ruta = (p: string) => fileURLToPath(new URL(p, import.meta.url));

/**
 * Pruebas unitarias (Definición de Terminado: cobertura mínima del 70 %).
 * Cubren la lógica de negocio y de servidor; las pantallas (.tsx) se validan
 * con las pruebas funcionales. Las pruebas de la base de datos (RLS, triggers)
 * están en supabase/tests y se ejecutan con `npm run test:db`.
 */
export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\//, replacement: `${ruta("./src")}/` },
      // Fuera de Next.js, «server-only» lanzaría un error al importarse.
      { find: /^server-only$/, replacement: ruta("./tests/apoyo/server-only.ts") },
    ],
  },
  test: {
    environment: "node",
    include: ["tests/unidad/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    env: {
      NEXT_PUBLIC_SITE_URL: "https://pedsar.test",
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "clave-publica-de-prueba",
      SUPABASE_SECRET_KEY: "clave-secreta-de-prueba",
      RESEND_API_KEY: "",
      NEXT_PUBLIC_SENTRY_DSN: "",
    },
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts", "src/config/**/*.ts", "src/features/**/*.ts", "src/app/**/route.ts", "src/proxy.ts", "src/instrumentation.ts"],
      exclude: ["**/*.d.ts", "**/*.tsx"],
      reporter: ["text-summary", "text", "html", "lcov"],
      reportsDirectory: "coverage",
      thresholds: { lines: 70, statements: 70, functions: 70, branches: 70 },
    },
  },
});
