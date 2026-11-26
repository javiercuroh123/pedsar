import Link from "next/link";
import { MessagesSquareIcon } from "lucide-react";
import { AvatarIniciales, Pildora } from "@/components/comunes";
import { formatearFechaHora } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { resumenSinLeer } from "./bandeja";
import type { ConversacionResumen } from "./consultas";

/**
 * HU-63 · Mensajes no leídos en el panel de inicio (estudiante o instructor):
 * el total y las tres conversaciones más recientes que tienen mensajes pendientes.
 */
export function MensajesSinLeer({
  items,
  href,
  todos,
  className,
}: {
  items: ConversacionResumen[];
  /** Enlace a una conversación. */
  href: (c: ConversacionResumen) => string;
  /** Enlace a la lista completa de mensajes. */
  todos: string;
  className?: string;
}) {
  const { total, conversaciones } = resumenSinLeer(items);

  return (
    <section aria-labelledby="mensajes-sin-leer" className={cn("animar-entrada overflow-hidden rounded-2xl border bg-card shadow-xs", className)}>
      <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
        <h2 id="mensajes-sin-leer" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          Mensajes
          {total > 0 && <Pildora color="indigo">{total} sin leer</Pildora>}
        </h2>
        <MessagesSquareIcon className="size-4 text-muted-foreground" />
      </div>
      {conversaciones.length ? (
        <ul className="divide-y">
          {conversaciones.map((c) => (
            <li key={`${c.cursoId}-${c.id}`}>
              <Link href={href(c)} className="flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-muted/40">
                <AvatarIniciales nombre={c.otro} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-semibold">{c.otro}</span>
                    <span className="shrink-0 text-xs font-medium whitespace-nowrap text-primary tabular-nums">
                      {c.noLeidos} {c.noLeidos === 1 ? "nuevo" : "nuevos"}
                    </span>
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {c.curso}
                    {c.ultimoEn ? ` · ${formatearFechaHora(c.ultimoEn)}` : ""}
                  </p>
                  {c.ultimoMensaje && <p className="mt-1 truncate text-sm">{c.ultimoMensaje}</p>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-5 py-6 text-center text-sm text-muted-foreground">No tienes mensajes sin leer.</p>
      )}
      <div className="border-t px-5 py-3 text-right">
        <Link href={todos} className="text-sm font-medium text-primary hover:underline">
          Ir a mensajes →
        </Link>
      </div>
    </section>
  );
}
