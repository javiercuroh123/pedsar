import { StarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const PROMEDIO = new Intl.NumberFormat("es-PE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Promedio de estrellas con un decimal («4.6»). */
export const formatearPromedio = (n: number) => PROMEDIO.format(n);

/** HU-24 · Calificación de 1 a 5 estrellas (solo visual; el tamaño sigue al texto). */
export function Estrellas({ valor, className }: { valor: number; className?: string }) {
  const llenas = Math.round(valor);
  return (
    <span role="img" aria-label={`${formatearPromedio(valor)} de 5 estrellas`} className={cn("inline-flex items-center gap-0.5 text-amber-500", className)}>
      {[1, 2, 3, 4, 5].map((i) => (
        <StarIcon key={i} aria-hidden className={cn("size-[1em]", i <= llenas ? "fill-current" : "text-muted-foreground/40")} />
      ))}
    </span>
  );
}

/** Promedio y cantidad para tarjetas y listas: ★ 4.6 (12 reseñas). */
export function ResumenCalificacion({ promedio, cantidad, className }: { promedio: number; cantidad: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm", className)}>
      <StarIcon aria-hidden className="size-4 fill-amber-500 text-amber-500" />
      <span className="font-semibold tabular-nums">{formatearPromedio(promedio)}</span>
      <span className="text-muted-foreground">
        ({cantidad} {cantidad === 1 ? "reseña" : "reseñas"})
      </span>
    </span>
  );
}
