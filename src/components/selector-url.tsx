"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { cn } from "@/lib/utils";

/** Select que guarda su valor en la URL (?param=valor), p. ej. para elegir el curso. */
export function SelectorUrl({
  param,
  valor,
  opciones,
  etiqueta,
  reiniciar = [],
  className,
}: {
  param: string;
  valor: string;
  opciones: { valor: string; etiqueta: string }[];
  etiqueta: string;
  /** Parámetros que se borran al cambiar (p. ej. la sesión al cambiar de curso). */
  reiniciar?: string[];
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pendiente, iniciar] = useTransition();

  return (
    <select
      aria-label={etiqueta}
      value={valor}
      disabled={pendiente}
      onChange={(e) => {
        const p = new URLSearchParams(params);
        p.set(param, e.target.value);
        reiniciar.forEach((r) => p.delete(r));
        iniciar(() => router.replace(`${pathname}?${p}`, { scroll: false }));
      }}
      className={cn(
        "h-9 max-w-full rounded-lg border border-input bg-card px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60",
        className,
      )}
    >
      {opciones.map((o) => (
        <option key={o.valor} value={o.valor}>
          {o.etiqueta}
        </option>
      ))}
    </select>
  );
}
