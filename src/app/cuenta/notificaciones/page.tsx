import type { Metadata } from "next";
import Link from "next/link";
import { BellIcon, BellOffIcon, CheckCheckIcon } from "lucide-react";
import { BotonAccion } from "@/components/boton-accion";
import { EncabezadoPagina, EstadoVacio, Pildora } from "@/components/comunes";
import { actualizarCanalNotificacion, marcarTodasLeidas } from "@/features/notificaciones/acciones";
import { listarNotificaciones } from "@/features/notificaciones/consultas";
import { requireUsuario } from "@/lib/auth";
import { formatearFechaHora } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Notificaciones" };

const CANALES = [
  { v: "AMBOS", t: "Correo e in-app", d: "Recibe avisos en la campana y por correo electrónico." },
  { v: "IN_APP", t: "Solo en la plataforma", d: "Muestra recordatorios únicamente en la campana." },
  { v: "CORREO", t: "Solo por correo", d: "Envía recordatorios de sesiones y evaluaciones a tu correo." },
] as const;

// HU-51 · HU-21 · HU-41 · HU-64 · Notificaciones y recordatorios
export default async function CuentaNotificacionesPage() {
  const usuario = await requireUsuario();
  const supabase = await createClient();
  const [notificaciones, { data: perfil }] = await Promise.all([
    listarNotificaciones(usuario.id, 100),
    supabase.from("perfiles").select("canal_notificacion").eq("id", usuario.id).maybeSingle(),
  ]);
  const canalActual = perfil?.canal_notificacion ?? "AMBOS";
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

      <section className="rounded-2xl border bg-card p-5 shadow-xs">
        <h2 className="text-sm font-semibold">Canal preferido para recordatorios</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Elige cómo recibir recordatorios automáticos (1 h antes de tus sesiones y 24 h antes del cierre de evaluaciones).
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {CANALES.map((c) => (
            <BotonAccion
              key={c.v}
              accion={actualizarCanalNotificacion}
              campos={{ canal: c.v }}
              variant={canalActual === c.v ? "default" : "outline"}
              size="sm"
              title={c.d}
            >
              {c.t}
            </BotonAccion>
          ))}
        </div>
      </section>
      {notificaciones.length ? (
        <ul className="divide-y overflow-hidden rounded-2xl border bg-card shadow-xs">
          {notificaciones.map((n) => (
            <li key={n.id} className={cn("flex gap-4 px-5 py-4", !n.leida && "bg-brand-50/60 dark:bg-brand-500/5")}>
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
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
              {!n.leida && <span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-rose-500" aria-label="Sin leer" />}
            </li>
          ))}
        </ul>
      ) : (
        <EstadoVacio icono={BellOffIcon} titulo="No tienes notificaciones" descripcion="Aquí verás recordatorios de sesiones, evaluaciones y pagos." />
      )}
    </div>
  );
}
