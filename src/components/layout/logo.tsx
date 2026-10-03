import { GraduationCapIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** Isotipo: birrete sobre degradado cian (mismo que el archivo de Figma). */
export function LogoMarca({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-[10px] bg-linear-to-br from-brand-400 to-brand-700 text-white shadow-md shadow-brand-700/25 transition-transform duration-300 ease-(--ease-salida) group-hover/logo:-rotate-6 group-hover/logo:scale-105",
        className,
      )}
    >
      <span className="absolute -top-3 -right-3 size-6 rounded-full bg-white/30 blur-md" />
      <GraduationCapIcon className="relative size-5" strokeWidth={2.2} />
    </span>
  );
}

export function Logo({ href = "/", claro = false, className }: { href?: string; claro?: boolean; className?: string }) {
  return (
    <Link href={href} className={cn("group/logo flex items-center gap-2.5", className)} aria-label="PEDSAR · Inicio">
      <LogoMarca />
      <span className="leading-none">
        <span className={cn("block text-lg font-semibold tracking-tight", claro && "text-white")}>PEDSAR</span>
        <span className={cn("mt-0.5 block text-xs font-medium whitespace-nowrap max-[380px]:hidden", claro ? "text-zinc-400" : "text-muted-foreground")}>
          Cursos y capacitaciones
        </span>
      </span>
    </Link>
  );
}
