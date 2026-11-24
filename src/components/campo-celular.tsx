"use client";

import { useId, useLayoutEffect, useReducer, useRef, useState } from "react";
import { celularValido, formatearCelular, normalizarCelular, posicionTrasDigitos } from "@/lib/telefono";
import { cn } from "@/lib/utils";

/**
 * Celular peruano: prefijo +51 fijo, solo dígitos y formato «987 654 321» mientras
 * se escribe. Envía el número formateado; el servidor lo normaliza con
 * `normalizarCelular` y lo valida con `errorCelular`.
 */
export function CampoCelular({
  id,
  name,
  defaultValue,
  required,
  className,
  ayuda = "9 dígitos, empieza con 9",
}: {
  id: string;
  name: string;
  defaultValue?: string | null;
  required?: boolean;
  className?: string;
  /** Texto bajo el campo cuando el número es válido o está vacío; null para ocultarlo. */
  ayuda?: string | null;
}) {
  const [digitos, setDigitos] = useState(() => normalizarCelular(defaultValue ?? ""));
  const [tocado, setTocado] = useState(false);
  const [, refrescar] = useReducer((n: number) => n + 1, 0);
  const ref = useRef<HTMLInputElement>(null);
  const cursorPendiente = useRef<number | null>(null);
  const idAyuda = useId();
  const invalido = tocado && digitos.length > 0 && !celularValido(digitos);

  // Tras cada cambio, el cursor vuelve detrás del mismo dígito: al reescribir el valor
  // formateado el navegador lo mandaría al final y editar en medio sería imposible.
  useLayoutEffect(() => {
    const el = ref.current;
    if (cursorPendiente.current === null || !el || document.activeElement !== el) return;
    const pos = posicionTrasDigitos(el.value, cursorPendiente.current);
    el.setSelectionRange(pos, pos);
    cursorPendiente.current = null;
  });

  const aplicar = (nuevos: string, digitosAntesDelCursor: number) => {
    cursorPendiente.current = digitosAntesDelCursor;
    setDigitos(nuevos);
    // Re-renderiza aunque los dígitos no cambien (p. ej. se tecleó una letra) para recolocar el cursor.
    refrescar();
  };

  return (
    <div className="space-y-1.5">
      <div
        className={cn(
          "flex h-10 w-full items-stretch overflow-hidden rounded-lg border border-input bg-card shadow-xs transition-[color,border-color,box-shadow] duration-200 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30",
          invalido && "border-destructive ring-3 ring-destructive/20 focus-within:border-destructive focus-within:ring-destructive/20 dark:border-destructive/50",
          className,
        )}
      >
        <span className="flex shrink-0 items-center gap-2 border-r border-input bg-muted/60 px-3 text-sm font-medium text-muted-foreground select-none" aria-hidden>
          <span className="flex h-3 w-[18px] overflow-hidden rounded-[2px] shadow-[0_0_0_1px_rgb(0_0_0/0.08)]">
            <span className="flex-1 bg-red-600" />
            <span className="flex-1 bg-white" />
            <span className="flex-1 bg-red-600" />
          </span>
          +51
        </span>
        <input
          ref={ref}
          id={id}
          name={name}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder="987 654 321"
          required={required}
          pattern="9\d{2} \d{3} \d{3}"
          title="Celular de 9 dígitos que empieza con 9"
          aria-invalid={invalido || undefined}
          aria-describedby={idAyuda}
          value={formatearCelular(digitos)}
          onChange={(e) => {
            const el = e.currentTarget;
            const cursor = el.selectionStart ?? el.value.length;
            aplicar(normalizarCelular(el.value), el.value.slice(0, cursor).replace(/\D/g, "").length);
          }}
          onKeyDown={(e) => {
            // Borrar sobre un espacio del formato elimina el dígito vecino, no "nada".
            const el = e.currentTarget;
            const ini = el.selectionStart ?? 0;
            if (ini !== el.selectionEnd) return;
            const antes = el.value.slice(0, ini).replace(/\D/g, "").length;
            if (e.key === "Backspace" && el.value[ini - 1] === " " && antes > 0) {
              e.preventDefault();
              aplicar(digitos.slice(0, antes - 1) + digitos.slice(antes), antes - 1);
            } else if (e.key === "Delete" && el.value[ini] === " ") {
              e.preventDefault();
              aplicar(digitos.slice(0, antes) + digitos.slice(antes + 1), antes);
            }
          }}
          onBlur={() => setTocado(true)}
          // w-0 + flex-1: ocupa el espacio libre sin aportar su ancho intrínseco (~20 caracteres)
          // al mínimo del contenedor; si no, ensancha las columnas de grilla en celulares.
          className="h-full w-0 min-w-0 flex-1 bg-transparent px-3 font-mono text-base tracking-wide outline-none placeholder:font-sans placeholder:tracking-normal placeholder:text-muted-foreground md:text-sm"
        />
      </div>
      {(invalido || ayuda) && (
        <p id={idAyuda} className={cn("text-xs", invalido ? "text-destructive" : "text-muted-foreground")} aria-live="polite">
          {invalido ? "Debe tener 9 dígitos y empezar con 9" : ayuda}
        </p>
      )}
    </div>
  );
}
