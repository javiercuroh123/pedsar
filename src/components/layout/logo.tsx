import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMarca({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative grid size-9 place-items-center overflow-hidden rounded-xl bg-linear-to-br from-brand-500 via-violet-600 to-fuchsia-600 font-mono text-base font-bold text-white shadow-md shadow-brand-600/30",
        className,
      )}
    >
      <span className="absolute -top-2 -right-2 size-5 rounded-full bg-orange-400/80 blur-[6px]" />
      <span className="relative">P</span>
    </span>
  );
}

export function Logo({ href = "/", claro = false, className }: { href?: string; claro?: boolean; className?: string }) {
  return (
    <Link href={href} className={cn("flex items-center gap-2.5", className)} aria-label="PEDSAR · Inicio">
      <LogoMarca />
      <span className="leading-none">
        <span className={cn("block text-[1.05rem] font-extrabold tracking-tight", claro && "text-white")}>PEDSAR</span>
        <span className={cn("block text-[0.62rem] font-medium tracking-[0.18em] uppercase", claro ? "text-white/60" : "text-muted-foreground")}>
          Capacitaciones
        </span>
      </span>
    </Link>
  );
}
