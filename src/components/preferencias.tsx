"use client";

import { Popover } from "@base-ui/react/popover";
import { AccessibilityIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Alterna entre modo claro y oscuro. */
export function BotonTema({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <Button
      variant="outline"
      size="icon"
      className={className}
      aria-label="Cambiar modo claro u oscuro"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <MoonIcon className="transition-transform duration-500 hover:-rotate-12 dark:hidden" />
      <SunIcon className="hidden transition-transform duration-500 dark:block dark:hover:rotate-45" />
    </Button>
  );
}

const TAMANOS = [
  { valor: "100%", etiqueta: "A", clase: "text-xs" },
  { valor: "112.5%", etiqueta: "A", clase: "text-sm" },
  { valor: "125%", etiqueta: "A", clase: "text-base" },
];

function guardar(clave: string, valor: string) {
  try {
    localStorage.setItem(clave, valor);
  } catch {
    // Almacenamiento no disponible (modo privado): la preferencia dura solo esta visita.
  }
}

// Estas funciones tocan el <html> directamente (fuera de React) y lo persisten.
function aplicarFuente(valor: string) {
  document.documentElement.style.fontSize = valor;
  guardar("pedsar-fuente", valor);
}

function alternarContraste() {
  const activo = document.documentElement.classList.toggle("alto-contraste");
  guardar("pedsar-contraste", activo ? "1" : "0");
  return activo;
}

// El popover solo se renderiza al abrirse (en el cliente), así que leer el DOM aquí no causa desajustes de hidratación.
const fuenteActual = () => (typeof document === "undefined" ? "100%" : document.documentElement.style.fontSize || "100%");
const contrasteActual = () => typeof document !== "undefined" && document.documentElement.classList.contains("alto-contraste");

function Interruptor({ activo, onClick, etiqueta }: { activo: boolean; onClick: () => void; etiqueta: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={etiqueta}
      onClick={onClick}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        activo ? "bg-primary" : "bg-input",
      )}
    >
      <span className={cn("absolute left-0.5 size-4 rounded-full bg-white shadow transition-transform", activo && "translate-x-4")} />
    </button>
  );
}

/** Opciones de accesibilidad (RNF-08): tamaño de texto, alto contraste y modo oscuro. */
export function MenuAccesibilidad({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [fuente, setFuente] = useState(fuenteActual);
  const [contraste, setContraste] = useState(contrasteActual);

  const cambiarFuente = (valor: string) => {
    aplicarFuente(valor);
    setFuente(valor);
  };
  const cambiarContraste = () => setContraste(alternarContraste());

  return (
    <Popover.Root>
      <Popover.Trigger
        render={<Button variant="outline" size="icon" className={className} aria-label="Opciones de accesibilidad" />}
      >
        <AccessibilityIcon />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={8} align="end" className="z-50">
          <Popover.Popup className="w-72 rounded-xl bg-popover p-4 text-sm text-popover-foreground shadow-xl ring-1 ring-foreground/10 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95">
            <Popover.Title className="font-semibold">Accesibilidad</Popover.Title>
            <p className="mt-4 text-xs font-medium text-muted-foreground">Tamaño de texto</p>
            <div className="mt-2 flex rounded-lg bg-muted p-1" role="group" aria-label="Tamaño de texto">
              {TAMANOS.map((t) => (
                <button
                  key={t.valor}
                  type="button"
                  aria-pressed={fuente === t.valor}
                  onClick={() => cambiarFuente(t.valor)}
                  className={cn(
                    "flex-1 rounded-md py-1 font-semibold transition",
                    t.clase,
                    fuente === t.valor ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
                  )}
                >
                  {t.etiqueta}
                </button>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between">
              <span>Alto contraste</span>
              <Interruptor activo={contraste} onClick={cambiarContraste} etiqueta="Alto contraste" />
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span>Modo oscuro</span>
              <Interruptor
                activo={resolvedTheme === "dark"}
                onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
                etiqueta="Modo oscuro"
              />
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Navega con <kbd className="rounded border px-1 font-mono">Tab</kbd> y{" "}
              <kbd className="rounded border px-1 font-mono">Shift+Tab</kbd>.{" "}
              <kbd className="rounded border px-1 font-mono">Esc</kbd> cierra ventanas.
            </p>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
