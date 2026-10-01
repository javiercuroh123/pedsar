import {
  BuildingIcon,
  ChartColumnIcon,
  CodeIcon,
  GlobeIcon,
  GraduationCapIcon,
  MonitorIcon,
  NetworkIcon,
  ShieldCheckIcon,
  ShuffleIcon,
  SparklesIcon,
  WrenchIcon,
  type LucideIcon,
} from "lucide-react";
import { createElement, type ComponentProps } from "react";
import { indiceDeTexto } from "@/components/comunes";
import { ETIQUETA_MODALIDAD } from "@/lib/formato";
import { cn } from "@/lib/utils";
import type { Modalidad } from "@/types/dominio";

// Degradado «color de la categoría → grafito» (mismo criterio que las portadas de Figma).
const DEGRADADOS = [
  "from-brand-600 to-zinc-900",
  "from-brand-800 to-zinc-950",
  "from-green-700 to-zinc-900",
  "from-violet-700 to-zinc-900",
  "from-rose-700 to-zinc-900",
  "from-amber-700 to-zinc-900",
  "from-zinc-600 to-zinc-950",
];

const POR_CATEGORIA: Record<string, { degradado: string; icono: LucideIcon }> = {
  programacion: { degradado: "from-brand-600 to-zinc-900", icono: CodeIcon },
  "desarrollo-web": { degradado: "from-brand-800 to-zinc-950", icono: GlobeIcon },
  "datos-ofimatica": { degradado: "from-green-700 to-zinc-900", icono: ChartColumnIcon },
  redes: { degradado: "from-zinc-600 to-zinc-950", icono: NetworkIcon },
  ciberseguridad: { degradado: "from-rose-700 to-zinc-900", icono: ShieldCheckIcon },
  "inteligencia-artificial": { degradado: "from-violet-700 to-zinc-900", icono: SparklesIcon },
  "soporte-tecnico": { degradado: "from-amber-700 to-zinc-900", icono: WrenchIcon },
};

export const ICONO_MODALIDAD: Record<Modalidad, typeof MonitorIcon> = {
  VIRTUAL: MonitorIcon,
  PRESENCIAL: BuildingIcon,
  SEMIPRESENCIAL: ShuffleIcon,
};

export const degradadoCategoria = (clave?: string | null) =>
  POR_CATEGORIA[clave ?? ""]?.degradado ?? DEGRADADOS[indiceDeTexto(clave ?? "pedsar", DEGRADADOS.length)];

export const iconoCategoria = (clave?: string | null): LucideIcon => POR_CATEGORIA[clave ?? ""]?.icono ?? GraduationCapIcon;

/** Ícono temático de la categoría (código, globo, gráfico, escudo…). */
export function IconoCategoria({ slug, ...props }: { slug?: string | null } & ComponentProps<LucideIcon>) {
  return createElement(iconoCategoria(slug), props);
}

/** Sigla del curso a partir del título (p. ej. "Excel empresarial" → "EX"). */
export const siglaCurso = (titulo: string) =>
  (titulo.replace(/[^\p{L}\p{N} ]/gu, "").trim().split(/\s+/)[0] ?? "").slice(0, 2).toUpperCase() || "PE";

/** Mini-portada cuadrada (listas y tablas): degradado e ícono de la categoría. */
export function SiglaCurso({ titulo, categoria, className }: { titulo: string; categoria?: string | null; className?: string }) {
  return (
    <span
      aria-hidden
      title={titulo}
      className={cn(
        "grid size-11 shrink-0 place-items-center rounded-xl bg-linear-to-br text-brand-100 shadow-sm",
        degradadoCategoria(categoria),
        className,
      )}
    >
      <IconoCategoria slug={categoria} className="size-[45%]" strokeWidth={1.8} />
    </span>
  );
}

/** Portada del curso: imagen subida o, si no hay, el degradado y el ícono de su categoría. */
export function PortadaCurso({
  titulo,
  imagen,
  categoria,
  modalidad,
  sinCupo,
  destacado,
  className,
}: {
  titulo: string;
  imagen?: string | null;
  categoria?: { nombre: string; slug: string } | null;
  modalidad: Modalidad;
  sinCupo?: boolean;
  destacado?: boolean;
  className?: string;
}) {
  const IconoModalidad = ICONO_MODALIDAD[modalidad];
  return (
    <div className={cn("relative h-42 overflow-hidden bg-linear-to-br text-white", degradadoCategoria(categoria?.slug), className)}>
      {imagen ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imagen}
          alt=""
          className="absolute inset-0 size-full object-cover transition-transform duration-700 ease-(--ease-salida) group-hover:scale-105"
        />
      ) : (
        <>
          <div className="fondo-puntos absolute inset-0 text-white/[0.08]" />
          <div className="absolute -top-16 -right-10 size-48 rounded-full bg-white/10 blur-2xl transition-transform duration-700 group-hover:scale-125" />
          <IconoCategoria
            slug={categoria?.slug}
            aria-label={titulo}
            className="absolute bottom-5 left-5 size-10 text-brand-200 transition-transform duration-500 ease-(--ease-salida) group-hover:-translate-y-1 group-hover:-rotate-6 group-hover:scale-110"
            strokeWidth={1.8}
          />
        </>
      )}
      <div className="absolute inset-x-4 top-4 flex items-start justify-between gap-2">
        {destacado ? (
          <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-700 shadow-sm">Destacado</span>
        ) : (
          <span />
        )}
        <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium text-white ring-1 ring-white/20 backdrop-blur">
          <IconoModalidad className="size-3" />
          {ETIQUETA_MODALIDAD[modalidad]}
        </span>
      </div>
      {sinCupo && (
        <span className="absolute right-4 bottom-4 rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-semibold text-white shadow-sm">
          Cupo lleno
        </span>
      )}
    </div>
  );
}
