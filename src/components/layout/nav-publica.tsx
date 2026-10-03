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
    <nav className="hidden items-center gap-7 self-stretch lg:flex" aria-label="Principal">
      {ENLACES_PUBLICOS.map((e) => {
        const activo = esActivo(pathname, e.href);
        return (
          <Link
            key={e.href}
            href={e.href}
            aria-current={activo ? "page" : undefined}
            className={cn(
              "relative flex h-full items-center text-sm font-medium transition-colors duration-200",
              "after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:transition-transform after:duration-300 after:ease-(--ease-salida)",
              activo
                ? "text-primary after:scale-x-100 after:bg-primary"
                : "text-muted-foreground after:scale-x-0 after:bg-foreground/20 hover:text-foreground hover:after:scale-x-100",
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
                esActivo(pathname, e.href) ? "bg-accent text-accent-foreground" : "hover:bg-muted",
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
