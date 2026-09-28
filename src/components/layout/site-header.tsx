import { LayoutDashboardIcon } from "lucide-react";
import Link from "next/link";
import { MenuAccesibilidad, BotonTema } from "@/components/preferencias";
import { buttonVariants } from "@/components/ui/button";
import { INICIO_POR_ROL } from "@/config/navegacion";
import { getUsuarioActual } from "@/lib/auth";
import { Logo } from "./logo";
import { MenuMovilPublico, NavPublica } from "./nav-publica";

export async function SiteHeader() {
  const usuario = await getUsuarioActual();
  const panel = usuario ? INICIO_POR_ROL[usuario.rol] : null;

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
        <Logo />
        <NavPublica />
        <div className="ml-auto flex items-center gap-1">
          <MenuAccesibilidad />
          <BotonTema />
          {panel ? (
            <Link href={panel} className={buttonVariants({ className: "ml-1 hidden h-9 px-3.5 sm:inline-flex" })}>
              <LayoutDashboardIcon />
              Mi panel
            </Link>
          ) : (
            <>
              <Link href="/login" className={buttonVariants({ variant: "ghost", className: "hidden h-9 px-3.5 sm:inline-flex" })}>
                Iniciar sesión
              </Link>
              <Link
                href="/registro"
                className={buttonVariants({
                  className:
                    "hidden h-9 bg-linear-to-r from-brand-600 to-violet-600 px-3.5 shadow-md shadow-brand-600/25 hover:opacity-90 sm:inline-flex",
                })}
              >
                Crear cuenta
              </Link>
            </>
          )}
          <MenuMovilPublico panel={panel} />
        </div>
      </div>
    </header>
  );
}
