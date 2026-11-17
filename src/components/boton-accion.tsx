"use client";

import { AlertTriangleIcon, Trash2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Botón que ejecuta una Server Action con FormData (campos ocultos incluidos)
 * y, si se indica `confirmar`, abre un diálogo de confirmación estilizado antes
 * de ejecutar acciones destructivas o sensibles. Si la acción devuelve
 * { ok, mensaje }, lo muestra como toast.
 */
export function BotonAccion({
  accion,
  campos,
  confirmar,
  tituloConfirmar,
  textoConfirmar,
  children,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "onClick" | "type"> & {
  accion: (datos: FormData) => Promise<unknown>;
  campos: Record<string, string | number>;
  confirmar?: string;
  tituloConfirmar?: string;
  textoConfirmar?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [pendiente, iniciar] = useTransition();

  const esEliminar = Boolean(confirmar && /^¿?\s*eliminar/i.test(confirmar));
  const esDestructivo =
    esEliminar ||
    Boolean(confirmar && /^¿?\s*(rechazar|ocultar|cancelar|desactivar)/i.test(confirmar)) ||
    (typeof props.className === "string" && /text-red|destructive/.test(props.className));

  const ejecutar = () => {
    const datos = new FormData();
    Object.entries(campos).forEach(([k, v]) => datos.set(k, String(v)));
    iniciar(async () => {
      const r = (await accion(datos)) as { ok?: boolean; mensaje?: string } | undefined;
      if (r?.mensaje) {
        (r.ok ? toast.success : toast.error)(r.mensaje);
      } else if (esEliminar) {
        toast.success("Elemento eliminado correctamente");
      }
      setAbierto(false);
    });
  };

  if (!confirmar) {
    return (
      <Button type="button" {...props} disabled={pendiente || props.disabled} onClick={ejecutar}>
        {children}
      </Button>
    );
  }

  const titulo =
    tituloConfirmar ??
    (esEliminar
      ? "Confirmar eliminación"
      : esDestructivo
        ? "Confirmar acción"
        : "¿Deseas continuar?");

  const etiquetaConfirmar =
    textoConfirmar ??
    (esEliminar ? "Sí, eliminar" : esDestructivo ? "Sí, continuar" : "Confirmar");

  const etiquetaCargando = esEliminar ? "Eliminando…" : "Procesando…";
  const tieneDetalleAdicional = confirmar.indexOf("?") < confirmar.length - 1;

  return (
    <>
      <Button
        type="button"
        {...props}
        disabled={pendiente || props.disabled}
        onClick={() => setAbierto(true)}
      >
        {children}
      </Button>
      <Dialog open={abierto} onOpenChange={(v) => !pendiente && setAbierto(v)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="gap-3">
            <div className="flex items-start gap-3.5">
              <span
                className={cn(
                  "grid size-10 shrink-0 place-items-center rounded-xl ring-1",
                  esDestructivo
                    ? "bg-red-50 text-red-600 ring-red-200/70 dark:bg-red-500/15 dark:text-red-400 dark:ring-red-500/30"
                    : "bg-amber-50 text-amber-600 ring-amber-200/70 dark:bg-amber-500/15 dark:text-amber-400 dark:ring-amber-500/30",
                )}
              >
                {esEliminar ? <Trash2Icon className="size-5" /> : <AlertTriangleIcon className="size-5" />}
              </span>
              <div className="min-w-0 flex-1 space-y-1.5 pt-0.5">
                <DialogTitle className="text-base font-semibold">{titulo}</DialogTitle>
                <DialogDescription className="text-sm leading-relaxed text-foreground/85">
                  {confirmar}
                </DialogDescription>
                {esEliminar && !tieneDetalleAdicional && (
                  <p className="text-xs text-muted-foreground">
                    Esta acción es permanente y no se puede deshacer.
                  </p>
                )}
              </div>
            </div>
          </DialogHeader>
          <DialogFooter className="mt-2">
            <Button
              type="button"
              variant="outline"
              disabled={pendiente}
              onClick={() => setAbierto(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant={esDestructivo ? "destructive" : "default"}
              className={cn(
                esDestructivo &&
                  "bg-red-600 text-white shadow-xs hover:bg-red-700 dark:bg-red-600 dark:text-white dark:hover:bg-red-500",
              )}
              disabled={pendiente}
              onClick={ejecutar}
            >
              {esEliminar && <Trash2Icon className="size-4" />}
              {pendiente ? etiquetaCargando : etiquetaConfirmar}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
