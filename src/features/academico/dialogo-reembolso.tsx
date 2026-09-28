"use client";

import { useActionState, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { EstadoFormulario } from "@/features/usuarios/esquemas";
import { solicitarReembolso } from "./acciones-estudiante";

export function DialogoReembolso({ pagos }: { pagos: { id: string; etiqueta: string }[] }) {
  const [abierto, setAbierto] = useState(false);
  const [, accion, pendiente] = useActionState(async (previo: EstadoFormulario, datos: FormData) => {
    const r = await solicitarReembolso(previo, datos);
    if (r.ok) {
      toast.success(r.mensaje);
      setAbierto(false);
    } else toast.error(r.mensaje);
    return r;
  }, {});

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger render={<button type="button" className="font-semibold text-primary underline-offset-4 hover:underline" disabled={!pagos.length} />}>
        Solicitar reembolso
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Solicitar reembolso</DialogTitle>
          <DialogDescription>
            Las solicitudes se atienden hasta 7 días antes del inicio del curso. El monto se devuelve por el mismo medio de pago.
          </DialogDescription>
        </DialogHeader>
        <form action={accion} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pagoId">Pago</Label>
            <select id="pagoId" name="pagoId" className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm dark:bg-input/30">
              {pagos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.etiqueta}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="motivo">Motivo</Label>
            <Textarea id="motivo" name="motivo" rows={4} required minLength={10} placeholder="Cuéntanos el motivo de tu solicitud" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAbierto(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pendiente}>
              {pendiente ? "Enviando…" : "Enviar solicitud"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
