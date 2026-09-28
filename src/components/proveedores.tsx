"use client";

import { ThemeProvider } from "next-themes";

/** Proveedores de cliente comunes a toda la app (tema claro / oscuro). */
export function Proveedores({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange storageKey="pedsar-tema">
      {children}
    </ThemeProvider>
  );
}
