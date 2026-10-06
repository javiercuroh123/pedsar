import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Destino de los enlaces que envía Supabase Auth (verificación de correo,
 * recuperación de contraseña e invitaciones). Según la plantilla, el enlace llega:
 * - con `token_hash` y `type` (plantilla propia: {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email);
 * - con `code` (plantilla por defecto y flujo PKCE: registro y recuperación);
 * - con la sesión en el fragmento `#access_token=…` (plantilla por defecto e invitación
 *   del administrador). El servidor no ve el fragmento, pero el navegador lo conserva
 *   al seguir la redirección, así que lo lee /auth/sesion.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "/";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/";

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, origin));
  } else if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
  } else {
    const sesion = new URL("/auth/sesion", origin);
    sesion.searchParams.set("next", next);
    return NextResponse.redirect(sesion);
  }

  return NextResponse.redirect(new URL("/login?error=enlace-invalido", origin));
}
