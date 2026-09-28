import { BotonTema, MenuAccesibilidad } from "@/components/preferencias";
import { NAV_POR_ROL } from "@/config/navegacion";
import { contarNoLeidas, listarNotificaciones } from "@/features/notificaciones/consultas";
import { nombreCompleto } from "@/lib/formato";
import type { Perfil, Rol } from "@/types/dominio";
import { CampanaNotificaciones, MenuUsuario } from "./menus-cabecera";
import { ContenidoLateral, MenuMovilPanel } from "./panel-nav";

const TITULO_PORTAL: Record<Rol, string> = {
  administrador: "Administración",
  instructor: "Portal del instructor",
  estudiante: "Portal del estudiante",
};

const ETIQUETA_ROL: Record<Rol, string> = {
  administrador: "Administrador",
  instructor: "Instructor",
  estudiante: "Estudiante",
};

/** Estructura común de los tres portales: barra lateral + cabecera + contenido. */
export async function PanelShell({ usuario, portal, children }: { usuario: Perfil; portal: Rol; children: React.ReactNode }) {
  const [recientes, noLeidas] = await Promise.all([listarNotificaciones(usuario.id, 6), contarNoLeidas(usuario.id)]);
  const grupos = NAV_POR_ROL[portal];
  const nombre = nombreCompleto(usuario) || usuario.correo;

  return (
    <div className="min-h-screen lg:pl-64 print:pl-0">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 lg:block print:hidden">
        <ContenidoLateral grupos={grupos} etiquetaPortal={TITULO_PORTAL[portal]} noLeidas={noLeidas} />
      </aside>

      <div className="flex min-h-screen min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex print:hidden h-16 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur-lg sm:px-6 lg:px-8">
          <MenuMovilPanel grupos={grupos} etiquetaPortal={TITULO_PORTAL[portal]} noLeidas={noLeidas} />
          <p className="truncate text-sm text-muted-foreground">
            <span className="hidden sm:inline">{TITULO_PORTAL[portal]} · </span>
            <span className="font-medium text-foreground">PEDSAR</span>
          </p>
          <div className="ml-auto flex items-center gap-1">
            <MenuAccesibilidad />
            <BotonTema />
            <CampanaNotificaciones recientes={recientes} noLeidas={noLeidas} />
            <MenuUsuario nombre={nombre} correo={usuario.correo} avatar={usuario.avatar_url} rol={ETIQUETA_ROL[usuario.rol]} />
          </div>
        </header>
        <main id="contenido" className="flex-1 px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
