"use client";

import { EyeOffIcon, StarIcon } from "lucide-react";
import { useActionState, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { EstadoFormulario } from "@/features/usuarios/esquemas";
import { cn } from "@/lib/utils";
import type { ResenaPropia } from "./consultas-resenas";
import { guardarResena } from "./resenas";

const MAXIMO = 500;
const ETIQUETA = ["", "Malo", "Regular", "Bueno", "Muy bueno", "Excelente"];

/** Selector accesible de 1 a 5 estrellas: radios con su etiqueta, se manejan con las flechas. */
function SelectorEstrellas({ valor, onChange }: { valor: number; onChange: (n: number) => void }) {
  const [sobre, setSobre] = useState(0);
  const mostrado = sobre || valor;
  return (
    <fieldset>
      <legend className="text-sm font-medium">Tu calificación</legend>
      <div className="mt-2 flex items-center gap-3">
        <div className="flex" onMouseLeave={() => setSobre(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="cursor-pointer rounded-md p-0.5 has-focus-visible:ring-3 has-focus-visible:ring-ring/50" onMouseEnter={() => setSobre(n)}>
              <input type="radio" name="estrellas" value={n} checked={valor === n} onChange={() => onChange(n)} className="sr-only" required />
              <StarIcon aria-hidden className={cn("size-7 transition-colors", n <= mostrado ? "fill-amber-500 text-amber-500" : "text-muted-foreground/40")} />
              <span className="sr-only">
                {n} {n === 1 ? "estrella" : "estrellas"} · {ETIQUETA[n]}
              </span>
            </label>
          ))}
        </div>
        <span className="text-sm text-muted-foreground" aria-hidden>
          {ETIQUETA[mostrado]}
        </span>
      </div>
    </fieldset>
  );
}

/** HU-24 · Calificación y reseña del curso completado; se puede editar después. */
export function FormularioResena({ inscripcionId, resena }: { inscripcionId: string; resena: ResenaPropia | null }) {
  const [estrellas, setEstrellas] = useState(resena?.estrellas ?? 0);
  const [texto, setTexto] = useState(resena?.texto ?? "");
  const [, accion, pendiente] = useActionState(async (previo: EstadoFormulario, datos: FormData) => {
    const r = await guardarResena(previo, datos);
    (r.ok ? toast.success : toast.error)(r.mensaje ?? "");
    return r;
  }, {});

  return (
    <section className="rounded-2xl border bg-card p-5 shadow-xs" aria-labelledby="titulo-resena">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="titulo-resena" className="font-semibold tracking-tight">
          {resena ? "Tu reseña" : "¿Qué te pareció el curso?"}
        </h2>
        {resena?.oculta && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-amber-200 ring-inset dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30">
            <EyeOffIcon className="size-3" /> Oculta por moderación
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {resena?.oculta
          ? "PEDSAR ocultó tu reseña del catálogo. Puedes editarla; seguirá oculta hasta que la revisen."
          : "Tu opinión aparece en la página del curso con tu nombre abreviado y ayuda a otros estudiantes."}
      </p>
      <form action={accion} className="mt-4 space-y-4">
        <input type="hidden" name="inscripcionId" value={inscripcionId} />
        <SelectorEstrellas valor={estrellas} onChange={setEstrellas} />
        <div>
          <label htmlFor="texto-resena" className="text-sm font-medium">
            Reseña <span className="font-normal text-muted-foreground">(opcional)</span>
          </label>
          <Textarea
            id="texto-resena"
            name="texto"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            maxLength={MAXIMO}
            rows={3}
            placeholder="Cuéntanos qué aprendiste y qué mejorarías"
            className="mt-1.5 resize-none"
          />
          <p className="mt-1 text-right text-[11px] text-muted-foreground tabular-nums">
            {texto.length}/{MAXIMO}
          </p>
        </div>
        <Button type="submit" disabled={pendiente || !estrellas}>
          {pendiente ? "Guardando…" : resena ? "Actualizar reseña" : "Publicar reseña"}
        </Button>
      </form>
    </section>
  );
}
