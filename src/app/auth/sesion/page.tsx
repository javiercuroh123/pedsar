"use client";

import { useEffect } from "react";
import { LoaderCircleIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/**
 * Abre la sesión que Supabase deja en el fragmento del enlace (#access_token=…&refresh_token=…),
 * como en la invitación del administrador con las plantillas por defecto. Llega desde /auth/confirm.
 * El cliente del navegador usa PKCE y no lee ese fragmento por sí solo, por eso se hace a mano.
 */
export default function SesionDesdeEnlace() {
  useEffect(() => {
    const fragmento = new URLSearchParams(window.location.hash.slice(1));
    const nextParam = new URLSearchParams(window.location.search).get("next") ?? "/";
    const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/";
    const access_token = fragmento.get("access_token");
    const refresh_token = fragmento.get("refresh_token");

    if (!access_token || !refresh_token) {
      window.location.replace("/login?error=enlace-invalido");
      return;
    }
    createClient()
      .auth.setSession({ access_token, refresh_token })
      .then(({ error }) => window.location.replace(error ? "/login?error=enlace-invalido" : next));
  }, []);

  return (
    <main id="contenido" className="grid flex-1 place-items-center p-6">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircleIcon className="size-4 animate-spin" />
        Verificando tu enlace…
      </p>
    </main>
  );
}
