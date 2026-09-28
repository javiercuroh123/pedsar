"use client";

import { MenuIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export const ENLACES_PUBLICOS = [
  { titulo: "Inicio", href: "/" },
  { titulo: "Cursos", href: "/cursos" },
  { titulo: "Nosotros", href: "/nosotros" },
  { titulo: "Contacto", href: "/contacto" },
  { titulo: "Verificar certificado", href: "/verificar" },
];

const esActivo = (pathname: string, href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

export function NavPublica() {
  const pathname = usePathname();
  return (
    <nav className="hidden items-center gap-1 lg:flex" aria-label="Principal">
      {ENLACES_PUBLICOS.map((e) => {
        const activo = esActivo(pathname, e.href);
        return (
          <Link
            key={e.href}
            href={e.href}
            aria-current={activo ? "page" : undefined}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
              activo
                ? "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {e.titulo}
          </Link>
        );
      })}
    </nav>
  );
}

export function MenuMovilPublico({ panel }: { panel: string | null }) {
  const pathname = usePathname();
  const [abierto, setAbierto] = useState(false);
  return (
    <Sheet open={abierto} onOpenChange={setAbierto}>
      <SheetTrigger render={<Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menú" />}>
        <MenuIcon />
      </SheetTrigger>
      <SheetContent side="right" className="p-6">
        <SheetTitle className="text-base font-semibold">Menú</SheetTitle>
        <nav className="mt-2 flex flex-col gap-1">
          {ENLACES_PUBLICOS.map((e) => (
            <Link
              key={e.href}
              href={e.href}
              onClick={() => setAbierto(false)}
              className={cn(
                "rounded-lg px-3 py-2.5 text-sm font-medium",
                esActivo(pathname, e.href) ? "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200" : "hover:bg-muted",
              )}
            >
              {e.titulo}
            </Link>
          ))}
        </nav>
        <div className="mt-auto grid gap-2">
          {panel ? (
            <Link href={panel} className={buttonVariants({ size: "lg" })} onClick={() => setAbierto(false)}>
              Ir a mi panel
            </Link>
          ) : (
            <>
              <Link href="/login" className={buttonVariants({ variant: "outline", size: "lg" })} onClick={() => setAbierto(false)}>
                Iniciar sesión
              </Link>
              <Link href="/registro" className={buttonVariants({ size: "lg" })} onClick={() => setAbierto(false)}>
                Crear cuenta
              </Link>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
