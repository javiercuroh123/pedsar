import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMarca({ className }: { className?: string }) {
  return (
    <Image
      src="/pedsar-emblema.webp"
      alt=""
      width={44}
      height={44}
      unoptimized
      className={cn("size-10 shrink-0 rounded-full ring-1 ring-zinc-400/30 sm:size-11", className)}
    />
  );
}

export function Logo({ href = "/", claro = false, className }: { href?: string; claro?: boolean; className?: string }) {
  return (
    <Link href={href} className={cn("flex items-center gap-2.5", className)} aria-label="PEDSAR · Inicio">
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
