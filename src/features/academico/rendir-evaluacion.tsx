"use client";

import { ArrowLeftIcon, ArrowRightIcon, SendIcon, TimerIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { NOTA_MINIMA } from "@/config/academico";
import { cn } from "@/lib/utils";
import { iniciarEvaluacion, enviarEvaluacion, type ResultadoEvaluacion } from "./acciones-estudiante";

export interface PreguntaPublica {
  id: number;
  enunciado: string;
  opciones: string[];
  puntaje: number;
}

const LETRAS = "ABCDEFGH";

export function RendirEvaluacion({
  evaluacionId,
  titulo,
  curso,
  tiempoMin,
  intentosPermitidos,
}: {
  evaluacionId: number;
  titulo: string;
  curso: string;
  tiempoMin: number | null;
  intentosPermitidos: number;
}) {
  const [i, setI] = useState(0);
  const [preguntas, setPreguntas] = useState<PreguntaPublica[]>([]);
  const [sesion, setSesion] = useState<{ intento: number; finLocal: number | null } | null>(null);
  const [resp, setResp] = useState<Record<string, string>>({});
  const [restante, setRestante] = useState<number | null>(null);
  const [resultado, setResultado] = useState<ResultadoEvaluacion | null>(null);
  const [enviando, iniciarTransicion] = useTransition();
  const enviado = useRef(false);
  // El envío automático por tiempo necesita las respuestas más recientes.
  const respRef = useRef(resp);
  useEffect(() => {
    respRef.current = resp;
  }, [resp]);

  const enviar = useCallback(() => {
    if (enviado.current || !sesion) return;
    enviado.current = true;
    iniciarTransicion(async () => {
      let r: ResultadoEvaluacion;
      try {
        r = await enviarEvaluacion(evaluacionId, respRef.current, sesion.intento);
      } catch {
        enviado.current = false;
        toast.error("No se pudo conectar. Puedes volver a enviar el mismo intento.");
        return;
      }
      if (!r.ok) {
        enviado.current = false;
        toast.error(r.mensaje ?? "No se pudo enviar la evaluación");
        return;
      }
      setResultado(r);
      try { sessionStorage.removeItem(`evaluacion:${evaluacionId}:${sesion.intento}`); } catch { /* almacenamiento deshabilitado */ }
      window.scrollTo({ top: 0 });
    });
  }, [evaluacionId, sesion]);

  const iniciar = () => iniciarTransicion(async () => {
    try {
      const r = await iniciarEvaluacion(evaluacionId);
      if (!r.ok) { toast.error(r.mensaje); return; }
      const segundos = r.sesion.vence_en ? Math.max(0, (Date.parse(r.sesion.vence_en) - Date.parse(r.sesion.servidor_en)) / 1000) : null;
      setSesion({ intento: r.sesion.numero_intento, finLocal: segundos === null ? null : Date.now() + segundos * 1000 });
      setRestante(segundos === null ? null : Math.ceil(segundos));
      setPreguntas(r.preguntas);
      try {
        const guardadas = JSON.parse(sessionStorage.getItem(`evaluacion:${evaluacionId}:${r.sesion.numero_intento}`) ?? "{}");
        if (guardadas && typeof guardadas === "object") setResp(guardadas);
      } catch { /* El plazo lo conserva el servidor aunque el navegador no guarde respuestas. */ }
    } catch { toast.error("No se pudo iniciar. Inténtalo de nuevo."); }
  });

  useEffect(() => {
    if (!sesion || resultado) return;
    try { sessionStorage.setItem(`evaluacion:${evaluacionId}:${sesion.intento}`, JSON.stringify(resp)); } catch { /* almacenamiento deshabilitado */ }
  }, [resp, sesion, resultado, evaluacionId]);

  useEffect(() => {
    if (restante === null || resultado || !sesion) return;
    if (restante <= 0) {
      toast.info("Se acabó el tiempo. Enviamos tus respuestas.");
      enviar();
      return;
    }
    const t = setTimeout(() => setRestante(Math.max(0, Math.ceil(((sesion.finLocal ?? Date.now()) - Date.now()) / 1000))), 1000);
    return () => clearTimeout(t);
  }, [restante, resultado, enviar, sesion]);

  if (!sesion) return (
    <div className="mx-auto max-w-xl space-y-4 rounded-2xl border bg-card p-8">
      <h1 className="text-2xl font-bold">{titulo}</h1>
      <p>{curso}</p>
      <p className="text-sm text-muted-foreground">{tiempoMin ? `Dispones de ${tiempoMin} minutos. El plazo continúa aunque cierres o recargues la página.` : "Esta evaluación no tiene límite de tiempo."}</p>
      <Button onClick={iniciar} disabled={enviando}>Iniciar o continuar evaluación</Button>
    </div>
  );

  if (resultado) {
    const pct = resultado.total ? (resultado.puntaje! / resultado.total) * 100 : 0;
    return (
      <div className="mx-auto max-w-xl">
        <div className="animar-escala rounded-2xl border bg-card p-8 text-center shadow-(--sombra-lg)">
          <div
            className="mx-auto grid size-36 place-items-center rounded-full"
            style={{ background: `conic-gradient(${resultado.aprobado ? "#10b981" : "#f43f5e"} ${pct}%, color-mix(in oklch, var(--muted-foreground) 20%, transparent) 0)` }}
          >
            <div className="grid size-[7.5rem] place-items-center rounded-full bg-card">
              <div>
                <p className="font-mono text-3xl font-bold">
                  {resultado.puntaje}/{resultado.total}
                </p>
                <p className="text-xs text-muted-foreground">puntos</p>
              </div>
            </div>
          </div>
          <h1 className={cn("mt-6 text-2xl font-bold", resultado.aprobado ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
            {resultado.aprobado ? "¡Evaluación aprobada!" : "Evaluación no aprobada"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {resultado.mensaje} Respondiste correctamente {resultado.correctas} de {resultado.preguntas} preguntas. Nota mínima aprobatoria: {NOTA_MINIMA}/20.
            {resultado.intentosRestantes ? ` Te quedan ${resultado.intentosRestantes} intento(s).` : ""}
          </p>
          <div className="mt-8 flex justify-center gap-2">
            {!resultado.aprobado && !!resultado.intentosRestantes && (
              <Button variant="outline" onClick={() => location.reload()}>
                Reintentar
              </Button>
            )}
            <Link href="/estudiante/evaluaciones" className={buttonVariants()}>
              Volver a evaluaciones
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const p = preguntas[i];
  const respondidas = Object.keys(resp).length;
  const mm = restante !== null ? String(Math.floor(restante / 60)).padStart(2, "0") : "";
  const ss = restante !== null ? String(restante % 60).padStart(2, "0") : "";

  const confirmarEnvio = () => {
    const faltan = preguntas.length - respondidas;
    if (faltan > 0 && !confirm(`Tienes ${faltan} pregunta(s) sin responder. Una vez enviada no podrás modificarla. ¿Enviar?`)) return;
    enviar();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{curso}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">{titulo}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {preguntas.length} preguntas · Intento {sesion.intento} de {intentosPermitidos}
          </p>
        </div>
        {restante !== null && (
          <div
            className={cn(
              "flex items-center gap-2 rounded-xl border bg-card px-4 py-2 shadow-xs",
              restante < 120 && "border-red-300 bg-red-50 text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300",
            )}
            role="timer"
            aria-label="Tiempo restante"
          >
            <TimerIcon className="size-4" />
            <span className="font-mono text-lg font-bold tabular-nums">
              {mm}:{ss}
            </span>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="rounded-2xl border bg-card p-6 shadow-xs sm:p-8">
          <p className="text-sm font-medium text-primary">
            Pregunta {i + 1} de {preguntas.length} · {p.puntaje} punto(s)
          </p>
          <h2 className="mt-3 text-lg leading-snug font-semibold whitespace-pre-line">{p.enunciado}</h2>
          <div className="mt-6 space-y-3" role="radiogroup" aria-label={`Opciones de la pregunta ${i + 1}`}>
            {p.opciones.map((o, k) => {
              const marcada = resp[p.id] === o;
              return (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={marcada}
                  onClick={() => setResp((r) => ({ ...r, [p.id]: o }))}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border p-4 text-left text-sm transition focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                    marcada ? "border-primary bg-brand-50/70 ring-1 ring-primary dark:bg-brand-500/10" : "hover:border-brand-300",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-7 shrink-0 place-items-center rounded-full border font-mono text-xs font-bold",
                      marcada ? "border-primary bg-primary text-primary-foreground" : "border-input",
                    )}
                  >
                    {LETRAS[k]}
                  </span>
                  {o}
                </button>
              );
            })}
          </div>
          <div className="mt-8 flex justify-between">
            <Button variant="outline" onClick={() => setI((x) => x - 1)} disabled={i === 0}>
              <ArrowLeftIcon /> Anterior
            </Button>
            {i < preguntas.length - 1 ? (
              <Button onClick={() => setI((x) => x + 1)}>
                Siguiente <ArrowRightIcon />
              </Button>
            ) : (
              <Button onClick={confirmarEnvio} disabled={enviando}>
                <SendIcon /> Enviar
              </Button>
            )}
          </div>
        </div>

        <aside className="h-fit rounded-2xl border bg-card p-5 shadow-xs">
          <p className="text-sm font-semibold">Preguntas</p>
          <div className="mt-4 grid grid-cols-5 gap-2">
            {preguntas.map((q, k) => (
              <button
                key={q.id}
                type="button"
                onClick={() => setI(k)}
                aria-label={`Ir a la pregunta ${k + 1}${resp[q.id] ? " (respondida)" : ""}`}
                className={cn(
                  "grid h-9 place-items-center rounded-lg border font-mono text-sm transition",
                  k === i && "ring-2 ring-primary",
                  resp[q.id] ? "border-transparent bg-primary text-primary-foreground" : "hover:bg-muted",
                )}
              >
                {k + 1}
              </button>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            {respondidas} de {preguntas.length} respondidas
          </p>
          <Button className="mt-4 w-full" onClick={confirmarEnvio} disabled={enviando}>
            {enviando ? "Enviando…" : "Enviar evaluación"}
          </Button>
        </aside>
      </div>
    </div>
  );
}
