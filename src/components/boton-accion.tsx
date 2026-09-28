"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * Botón que ejecuta una Server Action con FormData (campos ocultos incluidos)
 * y, si se indica, pide confirmación antes de acciones destructivas. Si la
 * acción devuelve { ok, mensaje }, lo muestra como toast.
 */
export function BotonAccion({
  accion,
  campos,
  confirmar,
  children,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "onClick" | "type"> & {
  accion: (datos: FormData) => Promise<unknown>;
  campos: Record<string, string | number>;
  confirmar?: string;
}) {
  const [pendiente, iniciar] = useTransition();
  return (
    <Button
      type="button"
      {...props}
      disabled={pendiente || props.disabled}
      onClick={() => {
        if (confirmar && !window.confirm(confirmar)) return;
        const datos = new FormData();
        Object.entries(campos).forEach(([k, v]) => datos.set(k, String(v)));
        iniciar(async () => {
          const r = (await accion(datos)) as { ok?: boolean; mensaje?: string } | undefined;
          if (r?.mensaje) (r.ok ? toast.success : toast.error)(r.mensaje);
        });
      }}
    >
      {children}
    </Button>
  );
}
