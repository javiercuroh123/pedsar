import type { Metadata } from "next";
import Link from "next/link";
import { BellIcon, BellOffIcon, CheckCheckIcon } from "lucide-react";
import { BotonAccion } from "@/components/boton-accion";
import { EncabezadoPagina, EstadoVacio, Pildora } from "@/components/comunes";
import { marcarTodasLeidas } from "@/features/notificaciones/acciones";
import { listarNotificaciones } from "@/features/notificaciones/consultas";
import { requireUsuario } from "@/lib/auth";
import { formatearFechaHora } from "@/lib/formato";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Notificaciones" };

// HU-51 · HU-21 · HU-64 · Notificaciones y recordatorios
export default async function CuentaNotificacionesPage() {
  const usuario = await requireUsuario();
  const notificaciones = await listarNotificaciones(usuario.id, 100);
  const noLeidas = notificaciones.filter((n) => !n.leida).length;

  return (
    <div className="space-y-6">
      <EncabezadoPagina eyebrow="Cuenta" titulo="Notificaciones" descripcion="Avisos por correo e in-app sobre sesiones, evaluaciones y pagos.">
        {noLeidas > 0 && (
          <BotonAccion accion={marcarTodasLeidas} campos={{}} variant="outline">
            <CheckCheckIcon /> Marcar todo como leído
          </BotonAccion>
        )}
      </EncabezadoPagina>
      {notificaciones.length ? (
        <ul className="divide-y overflow-hidden rounded-2xl border bg-card shadow-xs">
          {notificaciones.map((n) => (
            <li key={n.id} className={cn("flex gap-4 px-5 py-4", !n.leida && "bg-brand-50/60 dark:bg-brand-500/5")}>
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-linear-to-br from-brand-100 to-violet-100 text-brand-700 dark:from-brand-500/15 dark:to-violet-500/10 dark:text-brand-300">
                <BellIcon className="size-4.5" />
              </span>
              <div className="min-w-0 flex-1">
                {n.enlace ? (
                  <Link href={n.enlace} className="text-sm font-medium hover:text-primary">
                    {n.mensaje}
                  </Link>
                ) : (
                  <p className="text-sm font-medium">{n.mensaje}</p>
                )}
                <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  {formatearFechaHora(n.fecha_envio)}
                  <Pildora>{n.tipo === "CORREO" ? "Correo" : "In-app"}</Pildora>
                </p>
              </div>
              {!n.leida && <span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-orange-500" aria-label="Sin leer" />}
            </li>
          ))}
        </ul>
      ) : (
        <EstadoVacio icono={BellOffIcon} titulo="No tienes notificaciones" descripcion="Aquí verás recordatorios de sesiones, evaluaciones y pagos." />
      )}
    </div>
  );
}
