"use client";

import { Loader2Icon } from "lucide-react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

/** Botón de envío que se deshabilita y muestra un indicador mientras la Server Action se ejecuta. */
export function BotonEnviar({
  children,
  pendiente,
  ...props
}: React.ComponentProps<typeof Button> & { pendiente?: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" {...props} disabled={pending || props.disabled}>
      {pending && <Loader2Icon className="animate-spin" />}
      {pending && pendiente ? pendiente : children}
    </Button>
  );
}
