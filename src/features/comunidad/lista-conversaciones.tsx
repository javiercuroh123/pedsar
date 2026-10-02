import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";
import { AvatarIniciales, Pildora } from "@/components/comunes";
import { formatearFechaHora } from "@/lib/formato";
import { cn } from "@/lib/utils";
import type { ConversacionResumen } from "./consultas";

/** Lista de conversaciones (estudiante o bandeja del instructor) con el último mensaje y los no leídos. */
export function ListaConversaciones({ items, href }: { items: ConversacionResumen[]; href: (c: ConversacionResumen) => string }) {
  return (
    <ul className="divide-y overflow-hidden rounded-2xl border bg-card shadow-xs">
      {items.map((c) => (
        <li key={`${c.cursoId}-${c.id ?? "nueva"}`}>
          <Link href={href(c)} className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-brand-50/50 dark:hover:bg-white/5">
            <AvatarIniciales nombre={c.otro} />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2">
                <span className={cn("truncate", c.noLeidos ? "font-semibold" : "font-medium")}>{c.otro}</span>
                <span className="text-xs text-muted-foreground">· {c.curso}</span>
              </p>
              <p className={cn("mt-0.5 truncate text-sm", c.noLeidos ? "text-foreground" : "text-muted-foreground")}>
                {c.ultimoMensaje ?? "Aún no hay mensajes. Escribe tu consulta."}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              {c.ultimoEn && <span className="text-xs whitespace-nowrap text-muted-foreground">{formatearFechaHora(c.ultimoEn)}</span>}
              {c.noLeidos > 0 && <Pildora color="indigo">{c.noLeidos} sin leer</Pildora>}
            </div>
            <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
