"use client";

import { Popover } from "@base-ui/react/popover";
import { BellIcon, BellOffIcon, ChevronDownIcon, GlobeIcon, LogOutIcon, UserRoundIcon } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import { AvatarIniciales } from "@/components/comunes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { marcarTodasLeidas } from "@/features/notificaciones/acciones";
import type { Notificacion } from "@/features/notificaciones/consultas";
import { cerrarSesion } from "@/features/usuarios/acciones";
import { cn } from "@/lib/utils";

const hace = (fecha: string) => {
  const min = Math.round((Date.now() - new Date(fecha).getTime()) / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  if (min < 1440) return `hace ${Math.round(min / 60)} h`;
  return new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short" }).format(new Date(fecha));
};

export function CampanaNotificaciones({ recientes, noLeidas }: { recientes: Notificacion[]; noLeidas: number }) {
  const [pendiente, iniciar] = useTransition();
  return (
    <Popover.Root>
      <Popover.Trigger
        render={
          <Button
            variant="outline"
            size="icon"
            className="group relative"
            aria-label={`Notificaciones${noLeidas ? ` (${noLeidas} sin leer)` : ""}`}
          />
        }
      >
        <BellIcon className="origin-top transition-transform group-hover:animate-[wiggle_0.6s_ease-in-out]" />
        {noLeidas > 0 && (
          <span className="latido absolute -top-1 -right-1 grid min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] leading-4 font-bold text-white ring-2 ring-card">
            {noLeidas > 9 ? "9+" : noLeidas}
          </span>
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={8} align="end" className="z-50">
          <Popover.Popup className="w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl bg-popover text-popover-foreground shadow-xl ring-1 ring-foreground/10 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <Popover.Title className="text-sm font-semibold">Notificaciones</Popover.Title>
              {noLeidas > 0 && (
                <button
                  type="button"
                  disabled={pendiente}
                  onClick={() => iniciar(() => marcarTodasLeidas())}
                  className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
                >
                  Marcar todo como leído
                </button>
              )}
            </div>
            {recientes.length ? (
              <ul className="max-h-96 divide-y overflow-y-auto">
                {recientes.map((n) => (
                  <li key={n.id} className={cn("flex gap-3 px-4 py-3 transition-colors hover:bg-muted/60", !n.leida && "bg-brand-50/60 dark:bg-brand-500/5")}>
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                      <BellIcon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      {n.enlace ? (
                        <Link href={n.enlace} className="text-sm hover:text-primary">
                          {n.mensaje}
                        </Link>
                      ) : (
                        <p className="text-sm">{n.mensaje}</p>
                      )}
                      <p className="mt-0.5 text-xs text-muted-foreground">{hace(n.fecha_envio)}</p>
                    </div>
                    {!n.leida && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-rose-500" aria-label="Sin leer" />}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-col items-center px-6 py-10 text-center text-sm text-muted-foreground">
                <BellOffIcon className="size-6" />
                <p className="mt-2">No tienes notificaciones</p>
              </div>
            )}
            <Link href="/cuenta/notificaciones" className="block border-t px-4 py-2.5 text-center text-sm font-medium hover:bg-muted">
              Ver todas
            </Link>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function MenuUsuario({ nombre, correo, avatar, rol }: { nombre: string; correo: string; avatar: string | null; rol: string }) {
  const [, iniciar] = useTransition();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="group flex items-center gap-2.5 rounded-lg p-1 pr-2 transition hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            aria-label="Menú de usuario"
          />
        }
      >
        <AvatarIniciales nombre={nombre} src={avatar} className="size-9" />
        <span className="hidden text-left leading-tight md:block">
          <span className="block max-w-36 truncate text-sm font-medium">{nombre}</span>
          <span className="block text-xs text-muted-foreground">{rol}</span>
        </span>
        <ChevronDownIcon className="hidden size-4 text-muted-foreground transition-transform duration-200 group-aria-expanded:rotate-180 md:block" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-2 py-1.5">
            <p className="truncate text-sm font-semibold text-foreground">{nombre}</p>
            <p className="truncate text-xs text-muted-foreground">{correo}</p>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/cuenta/perfil" />}>
          <UserRoundIcon /> Mi perfil
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/cuenta/notificaciones" />}>
          <BellIcon /> Notificaciones
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/" />}>
          <GlobeIcon /> Sitio público
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => iniciar(() => cerrarSesion())}>
          <LogOutIcon /> Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
