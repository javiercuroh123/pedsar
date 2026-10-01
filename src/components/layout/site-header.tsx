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
    <header className="sticky top-0 z-40 border-b border-border/80 bg-card/85 backdrop-blur-xl supports-[backdrop-filter]:bg-card/70">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-10 px-4 sm:px-6 lg:h-18 lg:px-8">
        <Logo />
        <NavPublica />
        <div className="ml-auto flex items-center gap-1.5">
          <MenuAccesibilidad />
          <BotonTema />
          {panel ? (
            <Link href={panel} className={buttonVariants({ className: "ml-2 max-sm:hidden" })}>
              <LayoutDashboardIcon />
              Mi panel
            </Link>
          ) : (
            <>
              <Link href="/login" className={buttonVariants({ variant: "ghost", className: "ml-1 max-sm:hidden" })}>
                Iniciar sesión
              </Link>
              <Link href="/registro" className={buttonVariants({ className: "max-sm:hidden" })}>
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
