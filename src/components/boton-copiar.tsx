"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function BotonCopiar({ texto, etiqueta = "Copiar" }: { texto: string; etiqueta?: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto);
          setCopiado(true);
          toast.success("Copiado al portapapeles");
          setTimeout(() => setCopiado(false), 1500);
        } catch {
          toast.error("No se pudo copiar");
        }
      }}
    >
      {copiado ? <CheckIcon /> : <CopyIcon />} {etiqueta}
    </Button>
  );
}
