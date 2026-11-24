import { NextResponse, type NextRequest } from "next/server";
import { VERSION_POLITICA_PRIVACIDAD } from "@/config/empresa";
import { INICIO_POR_ROL } from "@/config/navegacion";
import { registrarActividad } from "@/lib/auditoria";
import { createClient } from "@/lib/supabase/server";
import type { Rol } from "@/types/dominio";

/**
 * HU-45 · Retorno del login con Google. Supabase vuelve aquí con `code` (PKCE)
 * después de que el usuario elige su cuenta. Si llega `acepta` con la versión
 * vigente (registro con la casilla marcada), se guarda la aceptación de la
 * política de privacidad (HU-47/HU-49); si el perfil sigue sin aceptarla, pasa
 * por /auth/terminos antes de entrar.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next");
  const next = nextParam?.startsWith("/") && !nextParam.startsWith("//") ? nextParam : null;
  const ir = (ruta: string) => NextResponse.redirect(new URL(ruta, origin));

  // Sin código: el usuario canceló en Google o el enlace no es válido.
  if (!code) return ir("/login?error=google");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  const usuario = data?.user;
  if (error || !usuario) return ir("/login?error=google");

  const { data: perfil } = await supabase.from("perfiles").select("rol, estado, privacidad_aceptada_en").eq("id", usuario.id).single();

  if (!perfil?.estado) {
    await supabase.auth.signOut();
    return ir(perfil ? "/login?error=cuenta-inactiva" : "/login?error=google");
  }

  let aceptada = Boolean(perfil.privacidad_aceptada_en);
  if (!aceptada && searchParams.get("acepta") === VERSION_POLITICA_PRIVACIDAD) {
    const { error: errorAceptacion } = await supabase
      .from("perfiles")
      .update({
        privacidad_version: VERSION_POLITICA_PRIVACIDAD,
        privacidad_aceptada_en: new Date().toISOString(),
      })
      .eq("id", usuario.id);
    aceptada = !errorAceptacion;
  }

  if (!aceptada) {
    const terminos = new URL("/auth/terminos", origin);
    if (next) terminos.searchParams.set("next", next);
    return NextResponse.redirect(terminos);
  }

  await registrarActividad(usuario.id, "INICIO_SESION", {
    proveedor: "google",
  });
  return ir(next ?? INICIO_POR_ROL[(perfil.rol as Rol) ?? "estudiante"]);
}
