import { BuildingIcon, MonitorIcon, ShuffleIcon } from "lucide-react";
import { indiceDeTexto } from "@/components/comunes";
import { ETIQUETA_MODALIDAD } from "@/lib/formato";
import { cn } from "@/lib/utils";
import type { Modalidad } from "@/types/dominio";

// Cada categoría recibe un degradado propio para que el catálogo se vea variado.
const DEGRADADOS = [
  "from-brand-500 via-indigo-500 to-violet-600",
  "from-orange-400 via-rose-400 to-pink-500",
  "from-teal-400 via-emerald-500 to-green-600",
  "from-sky-400 via-blue-500 to-indigo-600",
  "from-fuchsia-500 via-purple-500 to-violet-600",
  "from-amber-400 via-orange-400 to-rose-500",
  "from-cyan-400 via-sky-500 to-blue-600",
];

export const ICONO_MODALIDAD: Record<Modalidad, typeof MonitorIcon> = {
  VIRTUAL: MonitorIcon,
  PRESENCIAL: BuildingIcon,
  SEMIPRESENCIAL: ShuffleIcon,
};

export const degradadoCategoria = (clave?: string | null) => DEGRADADOS[indiceDeTexto(clave ?? "pedsar", DEGRADADOS.length)];

/** Sigla del curso a partir del título (p. ej. "Excel empresarial" → "EX"). */
export const siglaCurso = (titulo: string) =>
  (titulo.replace(/[^\p{L}\p{N} ]/gu, "").trim().split(/\s+/)[0] ?? "").slice(0, 2).toUpperCase() || "PE";

/** Mini-portada cuadrada (listas y tablas). */
export function SiglaCurso({ titulo, categoria, className }: { titulo: string; categoria?: string | null; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-11 shrink-0 place-items-center rounded-xl bg-linear-to-br font-mono text-sm font-bold text-white shadow-sm",
        degradadoCategoria(categoria),
        className,
      )}
    >
      {siglaCurso(titulo)}
    </span>
  );
}

/** Portada del curso: imagen subida o, si no hay, un degradado por categoría con la sigla. */
export function PortadaCurso({
  titulo,
  imagen,
  categoria,
  modalidad,
  sinCupo,
  className,
}: {
  titulo: string;
  imagen?: string | null;
  categoria?: { nombre: string; slug: string } | null;
  modalidad: Modalidad;
  sinCupo?: boolean;
  className?: string;
}) {
  const Icono = ICONO_MODALIDAD[modalidad];
  return (
    <div className={cn("relative h-40 overflow-hidden bg-linear-to-br text-white", degradadoCategoria(categoria?.slug), className)}>
      {imagen ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imagen} alt="" className="absolute inset-0 size-full object-cover" />
      ) : (
        <>
          <div className="fondo-puntos absolute inset-0 text-white/25" />
          <div className="absolute -right-10 -bottom-16 size-48 rounded-full bg-white/15 blur-2xl" />
          <span className="absolute bottom-3 left-4 font-mono text-4xl font-bold tracking-tight drop-shadow-sm">
            {siglaCurso(titulo)}
          </span>
        </>
      )}
      <span className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-xs font-medium text-zinc-800 shadow-sm backdrop-blur dark:bg-zinc-950/75 dark:text-zinc-100">
        <Icono className="size-3" />
        {ETIQUETA_MODALIDAD[modalidad]}
      </span>
      {sinCupo && (
        <span className="absolute top-3 right-3 rounded-full bg-rose-600 px-2 py-0.5 text-xs font-semibold text-white shadow-sm">
          Cupo lleno
        </span>
      )}
    </div>
  );
}
