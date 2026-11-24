import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { INICIO_POR_ROL } from "@/config/navegacion";
import { TerminosForm } from "@/features/usuarios/formularios";
import { getUsuarioActual } from "@/lib/auth";

export const metadata: Metadata = { title: "Acepta la política de privacidad" };

/**
 * HU-45 + HU-47 · Quien entra con Google sin haber aceptado la política la acepta
 * aquí antes de usar la plataforma. No usa requireUsuario, que redirige a esta misma página.
 */
export default async function TerminosPage({ searchParams }: PageProps<"/auth/terminos">) {
  const usuario = await getUsuarioActual();
  if (!usuario) redirect("/login");
  if (!usuario.estado) redirect("/login?error=cuenta-inactiva");

  const { next } = await searchParams;
  const destino = typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : undefined;
  if (!usuario.pendienteTerminos) redirect(destino ?? INICIO_POR_ROL[usuario.rol]);

  const nombre = usuario.nombres.split(" ")[0];
  return (
    <>
      <h1 className="text-[1.875rem] leading-tight font-semibold tracking-tight">{nombre ? `¡Hola, ${nombre}!` : "¡Ya casi!"}</h1>
      <p className="mt-2 mb-8 text-sm text-muted-foreground">
        Entraste con tu cuenta de Google ({usuario.correo}). Antes de continuar, acepta nuestra política de privacidad.
      </p>
      <TerminosForm next={destino} />
    </>
  );
}
