"use client";

import { CheckCircle2Icon, SendIcon } from "lucide-react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { enviarContacto } from "./acciones";

const ASUNTOS = [
  { v: "informes", t: "Informes sobre cursos" },
  { v: "empresas", t: "Capacitación para empresas" },
  { v: "soporte", t: "Soporte de la plataforma" },
  { v: "reclamo", t: "Libro de reclamaciones" },
];

export function FormularioContacto({ asunto }: { asunto?: string }) {
  const [estado, accion, pendiente] = useActionState(enviarContacto, {});
  const error = (campo: string) => estado.errores?.[campo]?.[0];

  if (estado.ok) {
    return (
      <div className="flex flex-col items-center rounded-2xl bg-emerald-50 p-10 text-center text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300" role="status">
        <CheckCircle2Icon className="size-10" />
        <p className="mt-4 font-semibold">{estado.mensaje}</p>
      </div>
    );
  }

  return (
    <form action={accion} className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="nombre">Nombre completo</Label>
        <Input id="nombre" name="nombre" required autoComplete="name" className="h-10" aria-invalid={!!error("nombre")} />
        {error("nombre") && <p className="text-xs text-destructive">{error("nombre")}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="correo">Correo electrónico</Label>
        <Input id="correo" name="correo" type="email" required autoComplete="email" className="h-10" aria-invalid={!!error("correo")} />
        {error("correo") && <p className="text-xs text-destructive">{error("correo")}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="telefono">Celular (opcional)</Label>
        <Input id="telefono" name="telefono" inputMode="tel" autoComplete="tel" className="h-10 font-mono" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="asunto">Asunto</Label>
        <select
          id="asunto"
          name="asunto"
          defaultValue={ASUNTOS.some((a) => a.v === asunto) ? asunto : "informes"}
          className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        >
          {ASUNTOS.map((a) => (
            <option key={a.v} value={a.v}>
              {a.t}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="mensaje">Mensaje</Label>
        <Textarea id="mensaje" name="mensaje" rows={5} required aria-invalid={!!error("mensaje")} />
        {error("mensaje") && <p className="text-xs text-destructive">{error("mensaje")}</p>}
      </div>
      {estado.mensaje && !estado.ok && <p className="text-sm text-destructive sm:col-span-2">{estado.mensaje}</p>}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pendiente} className="h-10 px-5">
          <SendIcon />
          {pendiente ? "Enviando…" : "Enviar mensaje"}
        </Button>
      </div>
    </form>
  );
}
