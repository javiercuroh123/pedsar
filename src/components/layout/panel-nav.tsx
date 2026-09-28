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
  PanelLeftIcon,
  ReceiptIcon,
  ScrollTextIcon,
  TagsIcon,
  TicketPercentIcon,
  UserCheckIcon,
  UserRoundIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { GrupoNav, IconoNav } from "@/config/navegacion";
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
          <p className="px-3 pb-2 text-[11px] font-semibold tracking-[0.12em] text-sidebar-foreground/50 uppercase">{g.titulo}</p>
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
                    "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    esActivo
                      ? "bg-linear-to-r from-brand-500/90 to-violet-500/80 text-white shadow-md shadow-brand-900/40"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  )}
                >
                  <Icono className={cn("size-4 shrink-0", !esActivo && "text-sidebar-foreground/70 group-hover:text-orange-300")} />
                  <span className="flex-1">{item.titulo}</span>
                  {item.icono === "notificaciones" && noLeidas > 0 && (
                    <span className="rounded-full bg-orange-500 px-1.5 py-px text-[10px] font-bold text-white">{noLeidas}</span>
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

/** Contenido de la barra lateral: logo, menú y acceso al sitio público. */
export function ContenidoLateral({
  grupos,
  etiquetaPortal,
  noLeidas,
  alNavegar,
}: {
  grupos: GrupoNav[];
  etiquetaPortal: string;
  noLeidas?: number;
  alNavegar?: () => void;
}) {
  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-sidebar text-sidebar-foreground">
      <div className="pointer-events-none absolute -top-24 -left-20 size-64 rounded-full bg-brand-500/25 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-10 size-56 rounded-full bg-orange-500/15 blur-3xl" />
      <div className="relative flex h-16 shrink-0 items-center gap-2 border-b border-sidebar-border px-5">
        <Logo claro />
      </div>
      <div className="relative px-5 pt-5">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-white ring-1 ring-white/15">
          <span className="size-1.5 rounded-full bg-orange-400" />
          {etiquetaPortal}
        </span>
      </div>
      <div className="relative flex-1 overflow-y-auto px-3 py-5">
        <PanelNav grupos={grupos} noLeidas={noLeidas} alNavegar={alNavegar} />
      </div>
      <div className="relative border-t border-sidebar-border p-3">
        <Link
          href="/"
          onClick={alNavegar}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-white"
        >
          <GlobeIcon className="size-4" />
          Ver sitio público
        </Link>
      </div>
    </div>
  );
}

export function MenuMovilPanel(props: { grupos: GrupoNav[]; etiquetaPortal: string; noLeidas?: number }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <Sheet open={abierto} onOpenChange={setAbierto}>
      <SheetTrigger render={<Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menú" />}>
        <PanelLeftIcon />
      </SheetTrigger>
      <SheetContent side="left" className="w-72 border-0 p-0" showCloseButton={false}>
        <SheetTitle className="sr-only">Menú del portal</SheetTitle>
        <ContenidoLateral {...props} alNavegar={() => setAbierto(false)} />
      </SheetContent>
    </Sheet>
  );
}
