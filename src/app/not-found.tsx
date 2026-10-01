import Link from "next/link";
import { CompassIcon, SearchIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="relative flex flex-1 flex-col items-center justify-center gap-4 overflow-hidden px-4 py-24 text-center">
      <div className="pointer-events-none absolute top-1/4 left-1/2 -z-10 size-96 -translate-x-1/2 rounded-full bg-brand-400/20 blur-3xl" />
      <span className="animar-escala grid size-24 place-items-center rounded-3xl bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
        <SearchIcon className="flotar size-11" />
      </span>
      <p className="animar-entrada mt-2 text-xs font-semibold tracking-[0.08em] text-brand-700 uppercase [--i:1] dark:text-brand-300">Error 404</p>
      <h1 className="animar-entrada text-4xl font-bold tracking-tight [--i:2]">No encontramos esta página</h1>
      <p className="animar-entrada text-lg text-muted-foreground [--i:3]">Puede que el enlace esté roto o que el curso ya no esté disponible.</p>
      <div className="animar-entrada mt-2 flex gap-2 [--i:4]">
        <Link href="/" className={buttonVariants({ size: "lg" })}>
          Volver al inicio
        </Link>
        <Link href="/cursos" className={buttonVariants({ variant: "outline", size: "lg" })}>
          <CompassIcon /> Ver cursos
        </Link>
      </div>
    </main>
  );
}
