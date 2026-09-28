"use client";

import { useActionState, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { EstadoFormulario } from "@/features/usuarios/esquemas";
import { cn } from "@/lib/utils";

/**
 * Diálogo con un formulario conectado a una Server Action que devuelve
 * { ok, mensaje }. Muestra el resultado con un toast y se cierra al guardar.
 */
export function DialogoFormulario({
  disparador,
  titulo,
  descripcion,
  accion,
  textoEnviar = "Guardar",
  children,
  className,
  varianteDisparador = "default",
  tamanoDisparador = "default",
  claseDisparador,
}: {
  disparador: React.ReactNode;
  titulo: string;
  descripcion?: string;
  accion: (estado: EstadoFormulario, datos: FormData) => Promise<EstadoFormulario>;
  textoEnviar?: string;
  children: React.ReactNode;
  className?: string;
  varianteDisparador?: "default" | "outline" | "ghost" | "secondary";
  tamanoDisparador?: "default" | "sm" | "icon" | "icon-sm";
  claseDisparador?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [, enviar, pendiente] = useActionState(async (previo: EstadoFormulario, datos: FormData) => {
    const r = await accion(previo, datos);
    if (r.ok) {
      toast.success(r.mensaje ?? "Guardado");
      setAbierto(false);
    } else toast.error(r.mensaje ?? "No se pudo guardar");
    return r;
  }, {});

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger render={<Button variant={varianteDisparador} size={tamanoDisparador} className={claseDisparador} />}>{disparador}</DialogTrigger>
      <DialogContent className={cn("max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-lg", className)}>
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">{titulo}</DialogTitle>
          {descripcion && <DialogDescription>{descripcion}</DialogDescription>}
        </DialogHeader>
        <form action={enviar} className="space-y-4">
          {children}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAbierto(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pendiente}>
              {pendiente ? "Guardando…" : textoEnviar}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Campo de formulario con etiqueta, para usar dentro de los diálogos. */
export function CampoForm({ etiqueta, htmlFor, children, ayuda, className }: { etiqueta: string; htmlFor?: string; children: React.ReactNode; ayuda?: string; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {etiqueta}
      </label>
      {children}
      {ayuda && <p className="text-xs text-muted-foreground">{ayuda}</p>}
    </div>
  );
}

export const claseControl =
  "h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";
