import Link from "next/link";
import { CompassIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="relative flex flex-1 flex-col items-center justify-center gap-4 overflow-hidden px-4 py-24 text-center">
      <div className="pointer-events-none absolute top-1/4 left-1/2 -z-10 size-96 -translate-x-1/2 rounded-full bg-brand-400/20 blur-3xl" />
      <p className="texto-degradado text-7xl font-extrabold tracking-tight">404</p>
      <h1 className="text-3xl font-bold tracking-tight">Página no encontrada</h1>
      <p className="text-muted-foreground">La página que buscas no existe o fue movida.</p>
      <div className="mt-2 flex gap-2">
        <Link href="/" className={buttonVariants()}>
          Volver al inicio
        </Link>
        <Link href="/cursos" className={buttonVariants({ variant: "outline" })}>
          <CompassIcon /> Ver cursos
        </Link>
      </div>
    </main>
  );
}
