"use client";

import { StampIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { BarraProgreso, tabla } from "@/components/comunes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { emitirCertificados } from "./acciones";

export interface Candidato {
  inscripcionId: string;
  estudiante: string;
  curso: string;
  progreso: number;
  promedio: number | null;
}

/** Emisión individual o masiva de certificados (HU-60). */
export function EmisionCertificados({ candidatos }: { candidatos: Candidato[] }) {
  const [elegidos, setElegidos] = useState<Set<string>>(new Set());
  const [pendiente, iniciar] = useTransition();
  const todos = candidatos.length > 0 && elegidos.size === candidatos.length;

  const alternar = (id: string) =>
    setElegidos((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const emitir = () =>
    iniciar(async () => {
      const datos = new FormData();
      elegidos.forEach((id) => datos.append("inscripcion", id));
      const r = await emitirCertificados(datos);
      (r.ok ? toast.success : toast.error)(r.mensaje ?? "");
      if (r.ok) setElegidos(new Set());
    });

  return (
    <section className="overflow-hidden rounded-2xl border bg-card shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <div>
          <h2 className="font-semibold">Listos para emitir</h2>
          <p className="text-xs text-muted-foreground">Estudiantes con inscripción confirmada y sin certificado. Revisa su avance antes de emitir.</p>
        </div>
        <Button onClick={emitir} disabled={!elegidos.size || pendiente}>
          <StampIcon /> {pendiente ? "Emitiendo…" : `Emitir seleccionados (${elegidos.size})`}
        </Button>
      </div>
      {candidatos.length ? (
        <div className="overflow-x-auto">
          <table className={tabla.table}>
            <thead className={tabla.thead}>
              <tr>
                <th className={cn(tabla.th, "w-10")}>
                  <input
                    type="checkbox"
                    className="size-4"
                    checked={todos}
                    onChange={() => setElegidos(todos ? new Set() : new Set(candidatos.map((c) => c.inscripcionId)))}
                    aria-label="Seleccionar todos"
                  />
                </th>
                <th className={tabla.th}>Estudiante</th>
                <th className={tabla.th}>Curso</th>
                <th className={tabla.th}>Avance</th>
                <th className={tabla.th}>Promedio</th>
              </tr>
            </thead>
            <tbody>
              {candidatos.map((c) => (
                <tr key={c.inscripcionId} className={cn(tabla.tr, elegidos.has(c.inscripcionId) && "bg-brand-50/60 dark:bg-brand-500/5")}>
                  <td className={tabla.td}>
                    <input type="checkbox" className="size-4" checked={elegidos.has(c.inscripcionId)} onChange={() => alternar(c.inscripcionId)} aria-label={`Seleccionar ${c.estudiante}`} />
                  </td>
                  <td className={cn(tabla.td, "font-medium")}>{c.estudiante}</td>
                  <td className={cn(tabla.td, "text-muted-foreground")}>{c.curso}</td>
                  <td className={tabla.td}>
                    <div className="flex items-center gap-2">
                      <BarraProgreso valor={c.progreso} tono={c.progreso >= 100 ? "turquesa" : "ambar"} className="h-1.5 w-20" />
                      <span className="font-mono text-xs">{c.progreso}%</span>
                    </div>
                  </td>
                  <td className={cn(tabla.td, "font-mono")}>{c.promedio !== null ? `${c.promedio.toFixed(1)}/20` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="px-5 py-10 text-center text-sm text-muted-foreground">No hay estudiantes pendientes de certificado.</p>
      )}
    </section>
  );
}
