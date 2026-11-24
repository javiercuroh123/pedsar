import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { INICIO_POR_ROL } from "@/config/navegacion";
import { createClient } from "@/lib/supabase/server";
import type { Perfil, Rol } from "@/types/dominio";

/** Usuario autenticado + su perfil. Se memoriza por request. */
export const getUsuarioActual = cache(async (): Promise<Perfil | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const id = claims?.sub;
  if (!id) return null;

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("id, nombres, apellidos, correo, rol, especialidad, avatar_url, estado, privacidad_aceptada_en")
    .eq("id", id)
    .single();
  if (!perfil) return null;

  // HU-45: quien entró con Google sin aceptar la política debe aceptarla primero.
  // Las cuentas invitadas o antiguas (sin Google) no se bloquean.
  const { privacidad_aceptada_en, ...resto } = perfil;
  const proveedores = (claims.app_metadata as { providers?: string[] } | undefined)?.providers ?? [];
  return { ...resto, pendienteTerminos: !privacidad_aceptada_en && proveedores.includes("google") } as Perfil;
});

/** Exige sesión activa. Úsalo en layouts y Server Actions. */
export async function requireUsuario(): Promise<Perfil> {
  const usuario = await getUsuarioActual();
  if (!usuario) redirect("/login");
  if (!usuario.estado) redirect("/login?error=cuenta-inactiva");
  if (usuario.pendienteTerminos) redirect("/auth/terminos");
  return usuario;
}

/** Exige uno de los roles indicados; si no, lo envía a su propio panel. */
export async function requireRol(...roles: Rol[]): Promise<Perfil> {
  const usuario = await requireUsuario();
  if (!roles.includes(usuario.rol)) redirect(INICIO_POR_ROL[usuario.rol]);
  return usuario;
}
