import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { RUTAS_PROTEGIDAS } from "@/config/navegacion";
import { publicEnv } from "@/lib/env";

/**
 * Refresca la sesión de Supabase en cada request y hace una comprobación
 * optimista: si la ruta es privada y no hay usuario, redirige a /login.
 * La verificación del ROL se hace en cada layout con `requireRol` (lib/auth.ts).
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // No colocar código entre createServerClient y getClaims().
  const { data } = await supabase.auth.getClaims();
  const usuario = data?.claims;

  const { pathname } = request.nextUrl;
  const esPrivada = RUTAS_PROTEGIDAS.some((r) => pathname.startsWith(r.prefijo));

  if (esPrivada && !usuario) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return response;
}
