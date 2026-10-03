"use client";

import { LibraryIcon, PlusIcon, SendIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CampoForm, claseControl } from "@/components/dialogo-formulario";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { crearEvaluacion } from "./acciones-instructor";

interface Pregunta {
  clave: number;
  enunciado: string;
  opciones: string[];
  correcta: number;
  puntaje: number;
}

const LETRAS = "ABCDEF";
let siguiente = 1;
const nueva = (): Pregunta => ({ clave: siguiente++, enunciado: "", opciones: ["", "", "", ""], correcta: 0, puntaje: 4 });

/** Constructor de evaluaciones de opción múltiple (HU-09 / HU-59). */
export function ConstructorEvaluacion({ cursos, cursoId }: { cursos: { id: string; titulo: string }[]; cursoId?: string }) {
  const router = useRouter();
  const [config, setConfig] = useState({ cursoId: cursoId ?? cursos[0]?.id ?? "", titulo: "", puntajeTotal: 20, intentos: 3, tiempo: 20 });
  const [preguntas, setPreguntas] = useState<Pregunta[]>(() => [nueva()]);
  const [pendiente, iniciar] = useTransition();

  const cambiar = (clave: number, cambios: Partial<Pregunta>) => setPreguntas((ps) => ps.map((p) => (p.clave === clave ? { ...p, ...cambios } : p)));
  const sumaPuntajes = preguntas.reduce((a, p) => a + (Number(p.puntaje) || 0), 0);

  const publicar = () =>
    iniciar(async () => {
      const r = await crearEvaluacion({ ...config, preguntas: preguntas.map(({ enunciado, opciones, correcta, puntaje }) => ({ enunciado, opciones, correcta, puntaje })) });
      if (r.ok) {
        toast.success(r.mensaje);
        setConfig((c) => ({ ...c, titulo: "" }));
        setPreguntas([nueva()]);
        router.replace("/instructor/evaluaciones");
      } else toast.error(r.mensaje);
    });

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
      <div className="h-fit space-y-4 rounded-2xl border bg-card p-5 shadow-xs lg:sticky lg:top-24">
        <h2 className="font-semibold">Configuración</h2>
        <CampoForm etiqueta="Título" htmlFor="ev-titulo">
          <Input id="ev-titulo" value={config.titulo} onChange={(e) => setConfig({ ...config, titulo: e.target.value })} placeholder="Módulo 4: Funciones" className="h-10" />
        </CampoForm>
        <CampoForm etiqueta="Curso" htmlFor="ev-curso">
          <select id="ev-curso" value={config.cursoId} onChange={(e) => setConfig({ ...config, cursoId: e.target.value })} className={claseControl}>
            {cursos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.titulo}
              </option>
            ))}
          </select>
        </CampoForm>
        <div className="grid grid-cols-3 gap-3">
          <CampoForm etiqueta="Tiempo" htmlFor="ev-tiempo" ayuda="min (0 = libre)">
            <Input id="ev-tiempo" type="number" min={0} value={config.tiempo} onChange={(e) => setConfig({ ...config, tiempo: Number(e.target.value) })} className="h-10" />
          </CampoForm>
          <CampoForm etiqueta="Intentos" htmlFor="ev-intentos">
            <Input id="ev-intentos" type="number" min={1} max={10} value={config.intentos} onChange={(e) => setConfig({ ...config, intentos: Number(e.target.value) })} className="h-10" />
          </CampoForm>
          <CampoForm etiqueta="Nota máx." htmlFor="ev-total">
            <Input id="ev-total" type="number" min={1} value={config.puntajeTotal} onChange={(e) => setConfig({ ...config, puntajeTotal: Number(e.target.value) })} className="h-10" />
          </CampoForm>
        </div>
        <p className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
          {preguntas.length} pregunta(s) · {sumaPuntajes} punto(s). Los puntos de cada pregunta se escalan a la nota máxima de {config.puntajeTotal}.
        </p>
        <Button className="w-full" onClick={publicar} disabled={pendiente || !config.titulo.trim() || !config.cursoId}>
          <SendIcon /> {pendiente ? "Publicando…" : "Publicar evaluación"}
        </Button>
      </div>

      <div className="space-y-4">
        {preguntas.map((p, i) => (
          <div key={p.clave} className="rounded-2xl border bg-card p-5 shadow-xs">
            <div className="flex items-center gap-3">
              <span className="grid size-7 place-items-center rounded-lg bg-brand-50 font-mono text-xs font-semibold text-brand-800 dark:bg-brand-500/15 dark:text-brand-200">{i + 1}</span>
              <p className="flex-1 text-sm font-semibold">Pregunta {i + 1}</p>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                Puntos
                <Input type="number" min={1} value={p.puntaje} onChange={(e) => cambiar(p.clave, { puntaje: Number(e.target.value) })} className="h-8 w-16 text-center" />
              </label>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-red-600 dark:text-red-400"
                aria-label={`Eliminar pregunta ${i + 1}`}
                disabled={preguntas.length === 1}
                onClick={() => setPreguntas((ps) => ps.filter((x) => x.clave !== p.clave))}
              >
                <Trash2Icon />
              </Button>
            </div>
            <Textarea
              rows={2}
              value={p.enunciado}
              onChange={(e) => cambiar(p.clave, { enunciado: e.target.value })}
              placeholder="Enunciado de la pregunta"
              className="mt-4"
              aria-label={`Enunciado de la pregunta ${i + 1}`}
            />
            <div className="mt-3 space-y-2" role="radiogroup" aria-label="Respuesta correcta">
              {p.opciones.map((o, k) => (
                <label key={k} className={cn("flex items-center gap-3 rounded-lg p-1 pr-0", p.correcta === k && "bg-green-50 dark:bg-green-500/10")}>
                  <input
                    type="radio"
                    name={`correcta-${p.clave}`}
                    checked={p.correcta === k}
                    onChange={() => cambiar(p.clave, { correcta: k })}
                    className="ml-1 size-4"
                    aria-label={`Marcar opción ${LETRAS[k]} como correcta`}
                  />
                  <span className="w-4 font-mono text-xs text-muted-foreground">{LETRAS[k]}</span>
                  <Input
                    value={o}
                    onChange={(e) => cambiar(p.clave, { opciones: p.opciones.map((x, j) => (j === k ? e.target.value : x)) })}
                    placeholder={`Opción ${LETRAS[k]}`}
                    className="h-9"
                  />
                </label>
              ))}
            </div>
            <div className="mt-2 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Marca la opción correcta con el círculo.</p>
              {p.opciones.length < 6 && (
                <Button variant="ghost" size="sm" onClick={() => cambiar(p.clave, { opciones: [...p.opciones, ""] })}>
                  <PlusIcon /> Opción
                </Button>
              )}
            </div>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setPreguntas((ps) => [...ps, nueva()])}>
            <PlusIcon /> Agregar pregunta
          </Button>
          <Button variant="ghost" disabled title="Próximamente">
            <LibraryIcon /> Banco de preguntas
          </Button>
        </div>
      </div>
    </div>
  );
}
