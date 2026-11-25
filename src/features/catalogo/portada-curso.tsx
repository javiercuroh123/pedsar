import {
  BuildingIcon,
  ChartColumnIcon,
  CloudIcon,
  CodeIcon,
  DatabaseIcon,
  FileSpreadsheetIcon,
  GlobeIcon,
  GraduationCapIcon,
  LaptopIcon,
  MonitorIcon,
  ServerIcon,
  ShieldCheckIcon,
  ShuffleIcon,
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

// Categorías del catálogo de la empresa (migración catalogo_tecnologia_informatica).
const POR_CATEGORIA: Record<string, { degradado: string; icono: LucideIcon }> = {
  "tecnologia-informatica": { degradado: "from-brand-700 to-zinc-950", icono: LaptopIcon },
  "ofimatica-excel": { degradado: "from-green-700 to-zinc-900", icono: FileSpreadsheetIcon },
  "datos-bi": { degradado: "from-amber-700 to-zinc-900", icono: ChartColumnIcon },
  "bases-de-datos": { degradado: "from-brand-800 to-zinc-950", icono: DatabaseIcon },
  programacion: { degradado: "from-brand-600 to-zinc-900", icono: CodeIcon },
  "desarrollo-web-movil": { degradado: "from-violet-700 to-zinc-900", icono: GlobeIcon },
  "redes-servidores": { degradado: "from-zinc-600 to-zinc-950", icono: ServerIcon },
  ciberseguridad: { degradado: "from-rose-700 to-zinc-900", icono: ShieldCheckIcon },
  "nube-procesos": { degradado: "from-sky-700 to-zinc-900", icono: CloudIcon },
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

const CURSOS_CON_PORTADA = new Set([
  "administracion-bd-sql-server",
  "analisis-datos-python-sql-server-power-bi",
  "aplicaciones-moviles",
  "aws-amazon-web-services",
  "bpm-gestion-procesos-negocio",
  "c-plus-plus",
  "c-sharp",
  "c-sharp-net",
  "ccna",
  "ciberseguridad",
  "dashboards-excel-power-bi",
  "desarrollo-java-i",
  "desarrollo-java-ii",
  "diseno-web-php",
  "diseno-web-visual-studio",
  "diseno-web-wordpress",
  "dns-dhcp",
  "excel-basico",
  "excel-desde-cero-hasta-macros",
  "excel-intermedio",
  "informatica-forense",
  "javascript",
  "linux",
  "mongodb",
  "ofimatica-basica",
  "ofimatica-intermedia",
  "ofimatica-profesional",
  "oracle",
  "power-bi-inteligencia-negocios",
  "programacion-python-i",
  "programacion-python-ii",
  "react-server",
  "windows-server-essentials",
]);

export function PortadaCurso({
  slug,
  titulo,
  imagen,
  categoria,
  modalidad,
  sinCupo,
  destacado,
  cargaDiferida = false,
  className,
}: {
  slug: string;
  titulo: string;
  imagen?: string | null;
  categoria?: { nombre: string; slug: string } | null;
  modalidad: Modalidad;
  sinCupo?: boolean;
  destacado?: boolean;
  cargaDiferida?: boolean;
  className?: string;
}) {
  const IconoModalidad = ICONO_MODALIDAD[modalidad];
  const portada = imagen || (CURSOS_CON_PORTADA.has(slug) ? `/cursos/${slug}.webp` : null);
  return (
    <div className={cn("relative h-42 overflow-hidden bg-linear-to-br text-white", degradadoCategoria(categoria?.slug), className)}>
      {portada ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={portada}
          loading={cargaDiferida ? "lazy" : undefined}
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
        <span className="inline-flex items-center gap-1 rounded-full bg-zinc-950/75 px-2.5 py-0.5 text-xs font-medium text-white ring-1 ring-white/20 backdrop-blur">
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
