"use client";

import { KeyRoundIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { NuevaContrasenaForm } from "./formularios";

/** HU-13 · Contraseña en el perfil: plegada hasta pulsar «Cambiar contraseña». */
export function SeccionContrasena() {
  const [abierta, setAbierta] = useState(false);
  const boton = useRef<HTMLButtonElement>(null);
  const volverAlBoton = useRef(false);

  useEffect(() => {
    if (!abierta && volverAlBoton.current) {
      volverAlBoton.current = false;
      boton.current?.focus();
    }
  }, [abierta]);

  const cerrar = useCallback(() => {
    volverAlBoton.current = true;
    setAbierta(false);
  }, []);
  const guardada = useCallback(() => {
    toast.success("Contraseña actualizada");
    cerrar();
  }, [cerrar]);

  return (
    <section aria-labelledby="titulo-contrasena" className="rounded-2xl border bg-card p-6 shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-100 dark:bg-brand-500/10 dark:text-brand-200 dark:ring-brand-500/20">
            <KeyRoundIcon className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 id="titulo-contrasena" className="font-semibold">
              Contraseña
            </h2>
            {!abierta && (
              <p className="mt-0.5 font-mono text-lg leading-6 tracking-[0.2em] text-muted-foreground" aria-label="Contraseña oculta">
                ••••••••••
              </p>
            )}
            <p className="mt-1 text-sm text-muted-foreground">Usa al menos 8 caracteres, con una mayúscula y un número.</p>
          </div>
        </div>
        {!abierta && (
          <Button ref={boton} type="button" variant="outline" onClick={() => setAbierta(true)} className="h-9 px-3.5">
            Cambiar contraseña
          </Button>
        )}
      </div>
      {abierta && (
        <div className="mt-5 border-t pt-5">
          <NuevaContrasenaForm alCancelar={cerrar} alGuardar={guardada} />
        </div>
      )}
    </section>
  );
}
