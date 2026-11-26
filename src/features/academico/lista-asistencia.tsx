"use client";

import { CheckCheckIcon, SaveIcon } from "lucide-react";
import { useActionState, useState } from "react";
import { toast } from "sonner";
import { AvatarIniciales } from "@/components/comunes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { EstadoFormulario } from "@/features/usuarios/esquemas";
import { cn } from "@/lib/utils";
import type { EstadoAsistencia } from "@/types/dominio";
import { guardarAsistencia } from "./acciones-instructor";

const OPCIONES: { v: EstadoAsistencia; t: string; activo: string }[] = [
  { v: "PRESENTE", t: "Presente", activo: "bg-green-600 text-white shadow-sm" },
  { v: "TARDANZA", t: "Tardanza", activo: "bg-amber-500 text-white shadow-sm" },
  { v: "JUSTIFICADA", t: "Justificada", activo: "bg-sky-600 text-white shadow-sm" },
  { v: "AUSENTE", t: "Ausente", activo: "bg-red-600 text-white shadow-sm" },
];

export type MarcaAsistencia = { estado: EstadoAsistencia; motivo: string | null };

export function ListaAsistencia({
  sesionId,
  fecha,
  estudiantes,
  iniciales,
}: {
  sesionId: number;
  fecha: string;
  estudiantes: { inscripcionId: string; nombre: string; avatar: string | null }[];
  iniciales: Record<string, MarcaAsistencia>;
}) {
  const [marcas, setMarcas] = useState<Record<string, EstadoAsistencia>>(() =>
    Object.fromEntries(estudiantes.map((e) => [e.inscripcionId, iniciales[e.inscripcionId]?.estado ?? "PRESENTE"])),
  );
  // HU-56 · El motivo se conserva aunque se cambie de estado y se vuelva a «Justificada».
  const [motivos, setMotivos] = useState<Record<string, string>>(() =>
    Object.fromEntries(estudiantes.map((e) => [e.inscripcionId, iniciales[e.inscripcionId]?.motivo ?? ""])),
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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { t: "Presentes", n: cuenta("PRESENTE"), c: "bg-green-600" },
          { t: "Tardanzas", n: cuenta("TARDANZA"), c: "bg-amber-500" },
          { t: "Justificadas", n: cuenta("JUSTIFICADA"), c: "bg-sky-600" },
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
          {estudiantes.map((e) => {
            const justificada = marcas[e.inscripcionId] === "JUSTIFICADA";
            return (
              <li key={e.inscripcionId} className="space-y-3 px-5 py-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="flex flex-1 items-center gap-3">
                    <AvatarIniciales nombre={e.nombre} src={e.avatar} className="size-8" />
                    <span className="text-sm font-medium">{e.nombre}</span>
                  </div>
                  <input type="hidden" name={`a:${e.inscripcionId}`} value={marcas[e.inscripcionId]} />
                  {/* En celular, cuatro opciones no caben en una fila: van en 2 × 2. */}
                  <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 sm:inline-flex sm:gap-0" role="radiogroup" aria-label={`Asistencia de ${e.nombre}`}>
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
                </div>
                {justificada && (
                  <div className="sm:pl-11">
                    <label htmlFor={`m-${e.inscripcionId}`} className="sr-only">
                      Motivo de la falta de {e.nombre}
                    </label>
                    <Input
                      id={`m-${e.inscripcionId}`}
                      name={`m:${e.inscripcionId}`}
                      value={motivos[e.inscripcionId] ?? ""}
                      onChange={(ev) => setMotivos((m) => ({ ...m, [e.inscripcionId]: ev.target.value }))}
                      required
                      minLength={3}
                      maxLength={300}
                      placeholder="Motivo de la falta (p. ej., cita médica con constancia)"
                      className="h-9"
                    />
                  </div>
                )}
              </li>
            );
          })}
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
