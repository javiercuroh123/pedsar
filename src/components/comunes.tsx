import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ETIQUETA_ESTADO, iniciales } from "@/lib/formato";
import { cn } from "@/lib/utils";

/** Título de página de los portales, con descripción y acciones a la derecha. */
export function EncabezadoPagina({
  titulo,
  descripcion,
  children,
  eyebrow,
}: {
  titulo: React.ReactNode;
  descripcion?: React.ReactNode;
  eyebrow?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-xs font-semibold tracking-[0.14em] text-primary uppercase">{eyebrow}</p>}
        <h1 className="text-2xl font-bold tracking-tight sm:text-[1.7rem]">{titulo}</h1>
        {descripcion && <p className="mt-1 text-sm text-muted-foreground">{descripcion}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export type Tono = "indigo" | "coral" | "turquesa" | "ambar" | "rosa" | "cielo";

const TONO_ICONO: Record<Tono, string> = {
  indigo: "bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300",
  coral: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
  turquesa: "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300",
  ambar: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  rosa: "bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300",
  cielo: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
};

const TONO_BARRA: Record<Tono, string> = {
  indigo: "from-brand-500 to-violet-500",
  coral: "from-orange-400 to-rose-500",
  turquesa: "from-teal-400 to-emerald-500",
  ambar: "from-amber-400 to-orange-400",
  rosa: "from-pink-400 to-fuchsia-500",
  cielo: "from-sky-400 to-blue-500",
};

/** Indicador (KPI) con ícono de color y una franja superior en degradado. */
export function TarjetaKpi({
  etiqueta,
  valor,
  detalle,
  icono: Icono,
  tono = "indigo",
}: {
  etiqueta: string;
  valor: React.ReactNode;
  detalle?: React.ReactNode;
  icono: LucideIcon;
  tono?: Tono;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border bg-card p-5 shadow-xs">
      <div className={cn("absolute inset-x-0 top-0 h-1 bg-linear-to-r", TONO_BARRA[tono])} />
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{etiqueta}</p>
        <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", TONO_ICONO[tono])}>
          <Icono className="size-4.5" />
        </span>
      </div>
      <p className="mt-2 text-3xl font-bold tracking-tight tabular-nums">{valor}</p>
      {detalle && <div className="mt-1 text-xs text-muted-foreground">{detalle}</div>}
    </div>
  );
}

export function IconoTono({ icono: Icono, tono = "indigo", className }: { icono: LucideIcon; tono?: Tono; className?: string }) {
  return (
    <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", TONO_ICONO[tono], className)}>
      <Icono className="size-5" />
    </span>
  );
}

/** Mensaje amigable cuando una lista está vacía. */
export function EstadoVacio({
  icono: Icono,
  titulo,
  descripcion,
  children,
  className,
}: {
  icono: LucideIcon;
  titulo: string;
  descripcion?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center rounded-2xl border border-dashed bg-card/50 px-6 py-14 text-center", className)}>
      <span className="grid size-12 place-items-center rounded-2xl bg-linear-to-br from-brand-100 to-violet-100 text-brand-600 dark:from-brand-500/15 dark:to-violet-500/15 dark:text-brand-300">
        <Icono className="size-6" />
      </span>
      <p className="mt-4 font-semibold">{titulo}</p>
      {descripcion && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{descripcion}</p>}
      {children && <div className="mt-5 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  );
}

const COLOR_ESTADO: Record<string, string> = {
  PUBLICADO: "verde",
  CONFIRMADA: "verde",
  APROBADO: "verde",
  PROCESADO: "verde",
  PENDIENTE: "ambar",
  SOLICITADO: "ambar",
  DESPUBLICADO: "ambar",
  BORRADOR: "gris",
  REEMBOLSADO: "gris",
  RECHAZADO: "rojo",
  CANCELADA: "rojo",
};

const CLASE_PILDORA = {
  verde: "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/25",
  ambar: "bg-amber-50 text-amber-800 ring-amber-600/25 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/25",
  rojo: "bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/25",
  gris: "bg-muted text-muted-foreground ring-foreground/10",
  indigo: "bg-brand-50 text-brand-700 ring-brand-600/20 dark:bg-brand-500/10 dark:text-brand-300 dark:ring-brand-500/25",
  coral: "bg-orange-50 text-orange-700 ring-orange-600/20 dark:bg-orange-500/10 dark:text-orange-300 dark:ring-orange-500/25",
  turquesa: "bg-teal-50 text-teal-700 ring-teal-600/20 dark:bg-teal-500/10 dark:text-teal-300 dark:ring-teal-500/25",
} as const;

export type ColorPildora = keyof typeof CLASE_PILDORA;

/** Etiqueta redondeada de color (estados, categorías, contadores). */
export function Pildora({
  color = "gris",
  children,
  className,
}: {
  color?: ColorPildora;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset [&>svg]:size-3",
        CLASE_PILDORA[color],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Estado de curso, inscripción, pago o reembolso con su color. */
export function EstadoBadge({ estado }: { estado: string }) {
  return (
    <Pildora color={(COLOR_ESTADO[estado] as ColorPildora) ?? "gris"}>
      <span className="size-1.5 rounded-full bg-current" />
      {ETIQUETA_ESTADO[estado] ?? estado}
    </Pildora>
  );
}

/** Barra de progreso sin JavaScript (apta para Server Components). */
export function BarraProgreso({
  valor,
  className,
  tono = "indigo",
  etiqueta,
}: {
  valor: number;
  className?: string;
  tono?: Tono | "rojo";
  etiqueta?: string;
}) {
  const v = Math.max(0, Math.min(100, valor));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(v)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={etiqueta}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}
    >
      <div
        className={cn("h-full rounded-full bg-linear-to-r", tono === "rojo" ? "from-rose-400 to-rose-600" : TONO_BARRA[tono])}
        style={{ width: `${v}%` }}
      />
    </div>
  );
}

/** Pestañas basadas en la URL (?tab=…): funcionan sin JavaScript y se pueden compartir. */
export function PestanasEnlace({
  items,
  activa,
  className,
}: {
  items: { valor: string; etiqueta: React.ReactNode; href: string }[];
  activa: string;
  className?: string;
}) {
  return (
    <nav className={cn("flex gap-6 overflow-x-auto border-b", className)} aria-label="Secciones">
      {items.map((i) => (
        <Link
          key={i.valor}
          href={i.href}
          scroll={false}
          aria-current={i.valor === activa ? "page" : undefined}
          className={cn(
            "-mb-px flex items-center gap-1.5 border-b-2 px-0.5 pb-3 text-sm font-medium whitespace-nowrap transition-colors",
            i.valor === activa
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {i.etiqueta}
        </Link>
      ))}
    </nav>
  );
}

const TONOS_AVATAR = [
  "bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-200",
  "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-200",
  "bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-200",
  "bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-200",
  "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-200",
];

export const indiceDeTexto = (texto: string, n: number) =>
  [...texto].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % n;

/** Avatar con iniciales; el color se deriva del nombre para que sea estable. */
export function AvatarIniciales({ nombre, src, className }: { nombre: string; src?: string | null; className?: string }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" className={cn("size-9 shrink-0 rounded-full object-cover", className)} />;
  }
  return (
    <span
      aria-hidden
      className={cn(
        "inline-grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold",
        TONOS_AVATAR[indiceDeTexto(nombre, TONOS_AVATAR.length)],
        className,
      )}
    >
      {iniciales(nombre)}
    </span>
  );
}

/** Contenedor de tabla con borde y encabezado opcional. */
export function PanelTabla({
  titulo,
  descripcion,
  accion,
  children,
  className,
}: {
  titulo?: React.ReactNode;
  descripcion?: React.ReactNode;
  accion?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("overflow-hidden rounded-2xl border bg-card shadow-xs", className)}>
      {titulo && (
        <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
          <div>
            <h2 className="font-semibold">{titulo}</h2>
            {descripcion && <p className="text-xs text-muted-foreground">{descripcion}</p>}
          </div>
          {accion}
        </div>
      )}
      <div className="overflow-x-auto">{children}</div>
    </section>
  );
}

/** Clases reutilizables para tablas simples de datos. */
export const tabla = {
  table: "w-full min-w-[720px] text-left text-sm",
  thead: "border-b bg-muted/50",
  th: "px-4 py-3 text-xs font-medium whitespace-nowrap text-muted-foreground",
  tr: "border-b last:border-0 transition-colors hover:bg-muted/40",
  td: "px-4 py-3 align-middle",
};
