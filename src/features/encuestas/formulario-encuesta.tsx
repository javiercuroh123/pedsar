"use client";

import { CircleCheckBigIcon, SendIcon } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { EstadoFormulario } from "@/features/usuarios/esquemas";
import { cn } from "@/lib/utils";
import { responderEncuesta } from "./acciones";
import { ESCALA, ETIQUETA_ASPECTO, type PreguntaEncuesta } from "./resultados";

/**
 * HU-43 · Formulario de la encuesta: cada afirmación se califica del 1 al 5
 * (de «muy en desacuerdo» a «muy de acuerdo»); las preguntas abiertas son texto.
 */
export function FormularioEncuesta({ envioId, preguntas }: { envioId: number; preguntas: PreguntaEncuesta[] }) {
  const [valores, setValores] = useState<Record<number, number>>({});
  const [estado, accion, pendiente] = useActionState(async (previo: EstadoFormulario, datos: FormData) => {
    const r = await responderEncuesta(previo, datos);
    if (r.ok) toast.success(r.mensaje ?? "¡Gracias por responder!");
    else toast.error(r.mensaje ?? "No se pudo guardar tu respuesta");
    return r;
  }, {});

  if (estado.ok) {
    return (
      <div className="flex flex-col items-center rounded-2xl border bg-card px-6 py-14 text-center shadow-xs">
        <span className="grid size-12 place-items-center rounded-xl bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-300">
          <CircleCheckBigIcon className="size-6" />
        </span>
        <p className="mt-4 text-lg font-semibold">¡Gracias por responder!</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">Tu opinión se muestra sin tu nombre en los resultados y nos ayuda a mejorar los cursos y la plataforma.</p>
        <Link href="/estudiante" className={buttonVariants({ className: "mt-6" })}>
          Volver al inicio
        </Link>
      </div>
    );
  }

  const escala = preguntas.filter((p) => p.tipo === "ESCALA");
  const faltan = escala.filter((p) => p.obligatoria && !valores[p.id]).length;

  return (
    <form action={accion} className="space-y-4">
      <input type="hidden" name="envioId" value={envioId} />
      {preguntas.map((p, i) => (
        <fieldset key={p.id} className="rounded-2xl border bg-card p-5 shadow-xs">
          <legend className="sr-only">{p.enunciado}</legend>
          <p className="flex items-baseline gap-2 text-xs font-semibold tracking-[0.08em] text-brand-700 uppercase dark:text-brand-300">
            <span>{i + 1}.</span>
            {p.aspecto ? ETIQUETA_ASPECTO[p.aspecto] : "Comentario"}
            {!p.obligatoria && <span className="font-normal tracking-normal text-muted-foreground normal-case">(opcional)</span>}
          </p>
          <p className="mt-1.5 font-medium" aria-hidden>
            {p.enunciado}
          </p>
          {p.tipo === "ESCALA" ? (
            <>
              <input type="hidden" name={`r:${p.id}`} value={valores[p.id] ?? ""} />
              <div role="radiogroup" aria-label={p.enunciado} className="mt-4 grid grid-cols-5 gap-2">
                {ESCALA.map((o) => {
                  const marcado = valores[p.id] === o.valor;
                  return (
                    <button
                      key={o.valor}
                      type="button"
                      role="radio"
                      aria-checked={marcado}
                      aria-label={`${o.valor}: ${o.etiqueta}`}
                      onClick={() => setValores((v) => ({ ...v, [p.id]: o.valor }))}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-xl border px-1 py-2.5 text-center transition",
                        marcado ? "border-primary bg-primary text-primary-foreground shadow-sm" : "hover:border-brand-300 hover:bg-muted/50",
                      )}
                    >
                      <span className="text-lg font-semibold tabular-nums">{o.valor}</span>
                      <span className={cn("hidden text-[11px] leading-tight sm:block", marcado ? "text-primary-foreground/90" : "text-muted-foreground")}>{o.etiqueta}</span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 flex justify-between text-[11px] text-muted-foreground sm:hidden">
                <span>1 · Muy en desacuerdo</span>
                <span>5 · Muy de acuerdo</span>
              </p>
            </>
          ) : (
            <Textarea name={`r:${p.id}`} rows={3} maxLength={1000} required={p.obligatoria} aria-label={p.enunciado} className="mt-3" placeholder="Escribe tu respuesta" />
          )}
        </fieldset>
      ))}
      <div className="flex flex-col-reverse items-stretch gap-3 rounded-2xl border bg-card p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {faltan ? `Te falta calificar ${faltan} afirmación(es).` : "Listo para enviar. En los resultados no se muestra tu nombre."}
        </p>
        <Button type="submit" disabled={pendiente || faltan > 0}>
          <SendIcon /> {pendiente ? "Enviando…" : "Enviar respuestas"}
        </Button>
      </div>
    </form>
  );
}
