"use client";

import { CircleAlertIcon, ListChecksIcon, StampIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { BarraProgreso, Pildora, tabla } from "@/components/comunes";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ResultadoAcademico } from "@/config/academico";
import { cn } from "@/lib/utils";
import { emitirCertificados } from "./acciones";

export interface Candidato {
  inscripcionId: string;
  estudiante: string;
  curso: string;
  resultado: ResultadoAcademico | null;
  apto: boolean;
  motivos: string[];
}

/**
 * Emisión individual o masiva de certificados (HU-11 · HU-60). Quien no cumple los
 * requisitos solo se emite como excepción, con un motivo que queda en la auditoría.
 */
export function EmisionCertificados({ candidatos }: { candidatos: Candidato[] }) {
  const [elegidos, setElegidos] = useState<Set<string>>(new Set());
  const [excepcion, setExcepcion] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [pendiente, iniciar] = useTransition();
  const todos = candidatos.length > 0 && elegidos.size === candidatos.length;
  const aptos = candidatos.filter((c) => c.apto);
  const noAptosElegidos = candidatos.filter((c) => !c.apto && elegidos.has(c.inscripcionId));

  const alternar = (id: string) =>
    setElegidos((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const enviar = (conMotivo?: string) =>
    iniciar(async () => {
      const datos = new FormData();
      elegidos.forEach((id) => datos.append("inscripcion", id));
      if (conMotivo) datos.set("motivo", conMotivo);
      const r = await emitirCertificados(datos);
      (r.ok ? toast.success : toast.error)(r.mensaje ?? "", { duration: 8000 });
      if (r.ok) {
        setElegidos(new Set());
        setExcepcion(false);
        setMotivo("");
      }
    });

  // Si hay seleccionados que no cumplen, primero se pide el motivo de la excepción.
  const emitir = () => (noAptosElegidos.length ? setExcepcion(true) : enviar());

  return (
    <section className="overflow-hidden rounded-2xl border bg-card shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <div>
          <h2 className="font-semibold">Pendientes de certificado</h2>
          <p className="text-xs text-muted-foreground">
            {aptos.length} de {candidatos.length} cumplen los requisitos. Los demás solo se emiten como excepción, con motivo.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setElegidos(new Set(aptos.map((c) => c.inscripcionId)))} disabled={!aptos.length || pendiente}>
            <ListChecksIcon /> Seleccionar aptos
          </Button>
          <Button onClick={emitir} disabled={!elegidos.size || pendiente}>
            <StampIcon /> {pendiente ? "Emitiendo…" : `Emitir seleccionados (${elegidos.size})`}
          </Button>
        </div>
      </div>
      {candidatos.length ? (
        <div className="overflow-x-auto">
          <table className={cn(tabla.table, "min-w-220")}>
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
                <th className={tabla.th}>Nota final</th>
                <th className={tabla.th}>Asistencia</th>
                <th className={tabla.th}>Avance</th>
                <th className={tabla.th}>Requisitos</th>
              </tr>
            </thead>
            <tbody>
              {candidatos.map((c) => {
                const r = c.resultado;
                return (
                  <tr key={c.inscripcionId} className={cn(tabla.tr, elegidos.has(c.inscripcionId) && "bg-brand-50/60 dark:bg-brand-500/5")}>
                    <td className={tabla.td}>
                      <input
                        type="checkbox"
                        className="size-4"
                        checked={elegidos.has(c.inscripcionId)}
                        onChange={() => alternar(c.inscripcionId)}
                        aria-label={`Seleccionar ${c.estudiante}`}
                      />
                    </td>
                    <td className={cn(tabla.td, "font-medium")}>{c.estudiante}</td>
                    <td className={cn(tabla.td, "text-muted-foreground")}>{c.curso}</td>
                    <td className={cn(tabla.td, "whitespace-nowrap")}>
                      {r?.evaluaciones ? (
                        <>
                          <span className="font-mono">{(r.nota_final ?? 0).toFixed(1)}/20</span>
                          <span className="block text-xs text-muted-foreground">
                            {r.rendidas} de {r.evaluaciones} rendidas
                          </span>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">Sin evaluaciones</span>
                      )}
                    </td>
                    <td className={cn(tabla.td, "whitespace-nowrap")}>
                      {r?.sesiones ? (
                        <>
                          <span className="font-mono">{Math.round(r.asistencia ?? 0)} %</span>
                          <span className="block text-xs text-muted-foreground">
                            {r.presentes} de {r.sesiones} sesiones
                          </span>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">Sin sesiones dictadas</span>
                      )}
                    </td>
                    <td className={tabla.td}>
                      {r?.contenidos ? (
                        <div className="flex items-center gap-2">
                          <BarraProgreso valor={r.progreso ?? 0} tono={(r.progreso ?? 0) >= 100 ? "turquesa" : "ambar"} className="h-1.5 w-16" />
                          <span className="font-mono text-xs">{Math.round(r.progreso ?? 0)}%</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className={cn(tabla.td, "max-w-64")}>
                      {c.apto ? (
                        <Pildora color="verde">Apto</Pildora>
                      ) : (
                        <>
                          <Pildora color="ambar">No cumple</Pildora>
                          <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                            {c.motivos.map((m) => (
                              <li key={m}>{m}</li>
                            ))}
                          </ul>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="px-5 py-10 text-center text-sm text-muted-foreground">No hay estudiantes pendientes de certificado.</p>
      )}

      <Dialog open={excepcion} onOpenChange={setExcepcion}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Emitir como excepción</DialogTitle>
            <DialogDescription>
              {noAptosElegidos.length} de los {elegidos.size} seleccionados no cumplen los requisitos. El motivo queda registrado en la auditoría y no
              se muestra en la verificación pública.
            </DialogDescription>
          </DialogHeader>
          <ul className="max-h-40 space-y-2 overflow-y-auto rounded-lg bg-muted/60 p-3 text-sm">
            {noAptosElegidos.map((c) => (
              <li key={c.inscripcionId} className="flex gap-2">
                <CircleAlertIcon className="mt-0.5 size-4 shrink-0 text-amber-600" />
                <span>
                  <b className="font-medium">{c.estudiante}</b> · {c.motivos.join("; ")}
                </span>
              </li>
            ))}
          </ul>
          <div className="space-y-1.5">
            <Label htmlFor="motivo-excepcion">Motivo de la excepción</Label>
            <Textarea
              id="motivo-excepcion"
              rows={3}
              minLength={10}
              maxLength={300}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej. Faltas justificadas con certificado médico; aprobó la evaluación de recuperación."
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setExcepcion(false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={motivo.trim().length < 10 || pendiente} onClick={() => enviar(motivo)}>
              {pendiente ? "Emitiendo…" : "Emitir con excepción"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
