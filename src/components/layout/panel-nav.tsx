"use client";

import {
  AwardIcon,
  BellIcon,
  BookOpenIcon,
  CalendarDaysIcon,
  ChartColumnIcon,
  ClipboardCheckIcon,
  CreditCardIcon,
  FolderOpenIcon,
  GlobeIcon,
  GraduationCapIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  MessagesSquareIcon,
  PanelLeftIcon,
  ReceiptIcon,
  ScrollTextIcon,
  StarIcon,
  TagsIcon,
  TicketPercentIcon,
  UserCheckIcon,
  UserRoundIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { AvatarIniciales } from "@/components/comunes";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { GrupoNav, IconoNav } from "@/config/navegacion";
import { cerrarSesion } from "@/features/usuarios/acciones";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";

const ICONOS: Record<IconoNav, LucideIcon> = {
  inicio: LayoutDashboardIcon,
  cursos: BookOpenIcon,
  evaluaciones: ClipboardCheckIcon,
  pagos: ReceiptIcon,
  certificados: AwardIcon,
  contenidos: FolderOpenIcon,
  sesiones: CalendarDaysIcon,
  asistencia: UserCheckIcon,
  notas: GraduationCapIcon,
  usuarios: UsersIcon,
  categorias: TagsIcon,
  inscripciones: CreditCardIcon,
  cupones: TicketPercentIcon,
  reportes: ChartColumnIcon,
  auditoria: ScrollTextIcon,
  perfil: UserRoundIcon,
  notificaciones: BellIcon,
  mensajes: MessagesSquareIcon,
  resenas: StarIcon,
};

/** Raíces de portal: solo se marcan activas con coincidencia exacta. */
const RAICES = ["/estudiante", "/instructor", "/admin"];

export function PanelNav({ grupos, noLeidas = 0, alNavegar }: { grupos: GrupoNav[]; noLeidas?: number; alNavegar?: () => void }) {
  const pathname = usePathname();
  const activo = (href: string) => (RAICES.includes(href) ? pathname === href : pathname.startsWith(href));

  return (
    <nav className="space-y-6" aria-label="Navegación del portal">
      {grupos.map((g) => (
        <div key={g.titulo}>
          <p className="px-3 pb-2 text-xs font-semibold tracking-[0.08em] text-zinc-500 uppercase">{g.titulo}</p>
          <div className="space-y-0.5">
            {g.items.map((item) => {
              const Icono = ICONOS[item.icono];
              const esActivo = activo(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={alNavegar}
                  aria-current={esActivo ? "page" : undefined}
                  className={cn(
                    "group relative flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors duration-200",
                    "before:absolute before:inset-y-2.5 before:-left-3 before:w-1 before:rounded-r-full before:bg-brand-300 before:transition-transform before:duration-300 before:ease-(--ease-salida)",
                    esActivo
                      ? "bg-brand-500/15 text-white before:scale-y-100"
                      : "text-sidebar-foreground before:scale-y-0 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  )}
                >
                  <Icono
                    className={cn(
                      "size-[18px] shrink-0 transition-[color,transform] duration-200 group-hover:scale-110",
                      esActivo ? "text-brand-300" : "text-zinc-400 group-hover:text-brand-300",
                    )}
                  />
                  <span className="flex-1 truncate">{item.titulo}</span>
                  {item.icono === "notificaciones" && noLeidas > 0 && (
                    <span className="latido rounded-full bg-rose-500 px-1.5 py-px text-[11px] font-semibold text-white">{noLeidas}</span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

export type UsuarioLateral = { nombre: string; correo: string; avatar: string | null };

/** Contenido de la barra lateral: logo, rol, menú, acceso al sitio público y tarjeta de usuario. */
export function ContenidoLateral({
  grupos,
  etiquetaPortal,
  noLeidas,
  usuario,
  alNavegar,
}: {
  grupos: GrupoNav[];
  etiquetaPortal: string;
  noLeidas?: number;
  usuario?: UsuarioLateral;
  alNavegar?: () => void;
}) {
  const [saliendo, iniciar] = useTransition();
  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-sidebar text-sidebar-foreground">
      <div className="pointer-events-none absolute -top-28 -left-24 size-64 rounded-full bg-brand-500/15 blur-3xl" />
      <div className="relative flex shrink-0 items-center px-6 pt-5">
        <Logo claro />
      </div>
      <div className="relative px-4 pt-5">
        <span className="flex items-center gap-2 rounded-lg bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-300">
          <span className="size-2 rounded-full bg-brand-400 shadow-[0_0_8px] shadow-brand-400/80" />
          {etiquetaPortal}
        </span>
      </div>
      <div className="relative flex-1 overflow-y-auto px-4 py-5">
        <PanelNav grupos={grupos} noLeidas={noLeidas} alNavegar={alNavegar} />
      </div>
      <div className="relative space-y-2 p-4">
        <Link
          href="/"
          onClick={alNavegar}
          className="group flex h-9 items-center gap-3 rounded-lg px-3 text-sm font-medium text-zinc-400 transition-colors hover:bg-sidebar-accent hover:text-white"
        >
          <GlobeIcon className="size-4 transition-transform duration-500 group-hover:rotate-180" />
          Ver sitio público
        </Link>
        {usuario && (
          <div className="flex items-center gap-2.5 rounded-xl bg-zinc-800 p-3">
            <AvatarIniciales nombre={usuario.nombre} src={usuario.avatar} />
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-medium text-white">{usuario.nombre}</p>
              <p className="truncate text-xs text-zinc-400">{usuario.correo}</p>
            </div>
            <button
              type="button"
              disabled={saliendo}
              onClick={() => iniciar(() => cerrarSesion())}
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
              className="grid size-8 shrink-0 place-items-center rounded-lg text-zinc-400 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
            >
              <LogOutIcon className="size-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function MenuMovilPanel(props: { grupos: GrupoNav[]; etiquetaPortal: string; noLeidas?: number; usuario?: UsuarioLateral }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <Sheet open={abierto} onOpenChange={setAbierto}>
      <SheetTrigger render={<Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menú" />}>
        <PanelLeftIcon />
      </SheetTrigger>
      <SheetContent side="left" className="w-72 border-0 p-0 sm:w-72" showCloseButton={false}>
        <SheetTitle className="sr-only">Menú del portal</SheetTitle>
        <ContenidoLateral {...props} alNavegar={() => setAbierto(false)} />
      </SheetContent>
    </Sheet>
  );
}
