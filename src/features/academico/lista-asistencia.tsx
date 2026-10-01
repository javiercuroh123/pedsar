"use client";

import { CheckCheckIcon, SaveIcon } from "lucide-react";
import { useActionState, useState } from "react";
import { toast } from "sonner";
import { AvatarIniciales } from "@/components/comunes";
import { Button } from "@/components/ui/button";
import type { EstadoFormulario } from "@/features/usuarios/esquemas";
import { cn } from "@/lib/utils";
import type { EstadoAsistencia } from "@/types/dominio";
import { guardarAsistencia } from "./acciones-instructor";

const OPCIONES: { v: EstadoAsistencia; t: string; activo: string }[] = [
  { v: "PRESENTE", t: "Presente", activo: "bg-green-600 text-white shadow-sm" },
  { v: "TARDANZA", t: "Tardanza", activo: "bg-amber-500 text-white shadow-sm" },
  { v: "AUSENTE", t: "Ausente", activo: "bg-red-600 text-white shadow-sm" },
];

export function ListaAsistencia({
  sesionId,
  fecha,
  estudiantes,
  iniciales,
}: {
  sesionId: number;
  fecha: string;
  estudiantes: { inscripcionId: string; nombre: string; avatar: string | null }[];
  iniciales: Record<string, EstadoAsistencia>;
}) {
  const [marcas, setMarcas] = useState<Record<string, EstadoAsistencia>>(() =>
    Object.fromEntries(estudiantes.map((e) => [e.inscripcionId, iniciales[e.inscripcionId] ?? "PRESENTE"])),
  );
  const [, accion, pendiente] = useActionState(async (previo: EstadoFormulario, datos: FormData) => {
    const r = await guardarAsistencia(previo, datos);
    if (r.ok) toast.success(r.mensaje);
    else toast.error(r.mensaje);
    return r;
  }, {});

  const cuenta = (v: EstadoAsistencia) => Object.values(marcas).filter((x) => x === v).length;

  return (
    <form action={accion} className="space-y-6">
      <input type="hidden" name="sesionId" value={sesionId} />
      <input type="hidden" name="fecha" value={fecha} />
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { t: "Presentes", n: cuenta("PRESENTE"), c: "bg-green-600" },
          { t: "Tardanzas", n: cuenta("TARDANZA"), c: "bg-amber-500" },
          { t: "Ausentes", n: cuenta("AUSENTE"), c: "bg-red-600" },
        ].map((k) => (
          <div key={k.t} className="relative flex items-center justify-between overflow-hidden rounded-2xl border bg-card p-4 shadow-xs">
            <span className={cn("absolute inset-y-0 left-0 w-1", k.c)} />
            <span className="text-sm text-muted-foreground">{k.t}</span>
            <span className="font-mono text-2xl font-bold" aria-live="polite">
              {k.n}
            </span>
          </div>
        ))}
      </div>

      <section className="overflow-hidden rounded-2xl border bg-card shadow-xs">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <p className="text-sm font-medium">{estudiantes.length} estudiantes inscritos</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setMarcas(Object.fromEntries(estudiantes.map((e) => [e.inscripcionId, "PRESENTE"])))}
          >
            <CheckCheckIcon /> Todos presentes
          </Button>
        </div>
        <ul className="divide-y">
          {estudiantes.map((e) => (
            <li key={e.inscripcionId} className="flex flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center">
              <div className="flex flex-1 items-center gap-3">
                <AvatarIniciales nombre={e.nombre} src={e.avatar} className="size-8" />
                <span className="text-sm font-medium">{e.nombre}</span>
              </div>
              <input type="hidden" name={`a:${e.inscripcionId}`} value={marcas[e.inscripcionId]} />
              <div className="inline-flex rounded-lg bg-muted p-1" role="radiogroup" aria-label={`Asistencia de ${e.nombre}`}>
                {OPCIONES.map((o) => (
                  <button
                    key={o.v}
                    type="button"
                    role="radio"
                    aria-checked={marcas[e.inscripcionId] === o.v}
                    onClick={() => setMarcas((m) => ({ ...m, [e.inscripcionId]: o.v }))}
                    className={cn(
                      "rounded-md px-3 py-1 text-xs font-semibold transition",
                      marcas[e.inscripcionId] === o.v ? o.activo : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {o.t}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
        <div className="flex justify-end border-t px-5 py-3">
          <Button type="submit" disabled={pendiente}>
            <SaveIcon /> {pendiente ? "Guardando…" : "Guardar asistencia"}
          </Button>
        </div>
      </section>
    </form>
  );
}
