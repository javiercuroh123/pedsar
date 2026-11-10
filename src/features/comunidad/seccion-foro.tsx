"use client";

import {
  CheckCircle2Icon,
  HelpCircleIcon,
  MessageSquarePlusIcon,
  MessagesSquareIcon,
  RotateCcwIcon,
  SendIcon,
  ShieldCheckIcon,
  Trash2Icon,
} from "lucide-react";
import { useActionState, useState } from "react";
import { toast } from "sonner";
import { BotonAccion } from "@/components/boton-accion";
import { Pildora } from "@/components/comunes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { EstadoFormulario } from "@/features/usuarios/esquemas";
import { formatearFechaHora } from "@/lib/formato";
import { cn } from "@/lib/utils";
import type { TemaForo } from "./consultas-foro";
import {
  alternarTemaResuelto,
  crearTemaForo,
  eliminarTemaForo,
  responderTemaForo,
} from "./foro";

function FormularioRespuesta({ temaId }: { temaId: number }) {
  const [texto, setTexto] = useState("");
  const [, accion, pendiente] = useActionState(async (previo: EstadoFormulario, datos: FormData) => {
    const r = await responderTemaForo(previo, datos);
    if (r.ok) {
      setTexto("");
      if (r.mensaje) toast.success(r.mensaje);
    } else if (r.mensaje) {
      toast.error(r.mensaje);
    }
    return r;
  }, {});

  return (
    <form action={accion} className="mt-3 flex gap-2">
      <input type="hidden" name="temaId" value={temaId} />
      <Input
        name="texto"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Escribe una respuesta o aclaración…"
        maxLength={2000}
        required
        className="flex-1"
      />
      <Button type="submit" size="sm" disabled={pendiente || texto.trim().length < 2}>
        <SendIcon className="size-3.5" /> {pendiente ? "Enviando…" : "Responder"}
      </Button>
    </form>
  );
}

/**
 * HU-22 · Foro de discusión por curso y HU-23 · Comentarios y preguntas por lección
 * con marca de resuelto e insignia de participación docente.
 */
export function SeccionForo({
  cursoId,
  contenidoActual,
  temas,
}: {
  cursoId: string;
  contenidoActual: { id: number; titulo: string } | null;
  temas: TemaForo[];
}) {
  const [pestana, setPestana] = useState<"leccion" | "foro" | "pendientes">(
    contenidoActual ? "leccion" : "foro",
  );
  const [abiertoNuevo, setAbiertoNuevo] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [cuerpo, setCuerpo] = useState("");

  const [, accionCrear, creando] = useActionState(async (previo: EstadoFormulario, datos: FormData) => {
    const r = await crearTemaForo(previo, datos);
    if (r.ok) {
      setTitulo("");
      setCuerpo("");
      setAbiertoNuevo(false);
      if (r.mensaje) toast.success(r.mensaje);
    } else if (r.mensaje) {
      toast.error(r.mensaje);
    }
    return r;
  }, {});

  const temasLeccion = contenidoActual
    ? temas.filter((t) => t.contenidoId === contenidoActual.id)
    : [];
  const temasGenerales = contenidoActual
    ? temas.filter((t) => t.contenidoId === null)
    : temas;
  const temasPendientes = temas.filter((t) => !t.resuelto);

  const visibles =
    pestana === "leccion" && contenidoActual
      ? temasLeccion
      : pestana === "pendientes"
        ? temasPendientes
        : temasGenerales;

  const enLeccion = pestana === "leccion" && contenidoActual;

  return (
    <section className="rounded-2xl border bg-card p-5 shadow-xs" aria-labelledby="titulo-foro-curso">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <div>
          <h2 id="titulo-foro-curso" className="flex items-center gap-2 font-semibold tracking-tight">
            <MessagesSquareIcon className="size-4 text-primary" />
            Comunidad y consultas del curso
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {enLeccion
              ? `Preguntas sobre «${contenidoActual.titulo}» y debates generales con tus compañeros e instructor.`
              : "Debates generales del curso y consultas por lección."}
          </p>
        </div>

        <Button
          type="button"
          size="sm"
          variant={abiertoNuevo ? "outline" : "default"}
          onClick={() => setAbiertoNuevo((v) => !v)}
        >
          <MessageSquarePlusIcon className="size-4" />
          {abiertoNuevo
            ? "Cancelar"
            : enLeccion
              ? "Preguntar en esta lección"
              : "Nuevo tema en el foro"}
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {contenidoActual && (
          <button
            type="button"
            onClick={() => setPestana("leccion")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition",
              pestana === "leccion"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            <HelpCircleIcon className="size-3.5" />
            Preguntas de esta lección ({temasLeccion.length})
          </button>
        )}
        <button
          type="button"
          onClick={() => setPestana("foro")}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition",
            pestana === "foro"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:text-foreground",
          )}
        >
          <MessagesSquareIcon className="size-3.5" />
          {contenidoActual ? `Foro general (${temasGenerales.length})` : `Todos los hilos (${temasGenerales.length})`}
        </button>
        {!contenidoActual && (
          <button
            type="button"
            onClick={() => setPestana("pendientes")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition",
              pestana === "pendientes"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            Por resolver ({temasPendientes.length})
          </button>
        )}
      </div>

      {abiertoNuevo && (
        <form action={accionCrear} className="mt-4 space-y-3 rounded-xl border bg-muted/30 p-4">
          <input type="hidden" name="cursoId" value={cursoId} />
          <input
            type="hidden"
            name="contenidoId"
            value={enLeccion ? String(contenidoActual.id) : ""}
          />
          <div>
            <label htmlFor="titulo-tema" className="text-xs font-medium">
              {enLeccion ? "Resumen de tu duda sobre esta lección" : "Título del tema"}
            </label>
            <Input
              id="titulo-tema"
              name="titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder={
                enLeccion
                  ? "Ej.: ¿Cómo se aplica este procedimiento en campo?"
                  : "Ej.: Recomendación de bibliografía o caso práctico"
              }
              maxLength={200}
              required
              className="mt-1 bg-background"
            />
          </div>
          <div>
            <label htmlFor="cuerpo-tema" className="text-xs font-medium">
              Detalle
            </label>
            <Textarea
              id="cuerpo-tema"
              name="cuerpo"
              value={cuerpo}
              onChange={(e) => setCuerpo(e.target.value)}
              placeholder="Explica tu consulta o aporte para que el instructor y tus compañeros puedan ayudarte…"
              rows={3}
              maxLength={3000}
              required
              className="mt-1 resize-none bg-background"
            />
          </div>
          <div className="flex justify-end">
            <Button
              type="submit"
              size="sm"
              disabled={creando || titulo.trim().length < 3 || cuerpo.trim().length < 3}
            >
              {creando ? "Publicando…" : "Publicar"}
            </Button>
          </div>
        </form>
      )}

      {visibles.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          {enLeccion
            ? "Aún no hay preguntas en esta lección. ¡Sé el primero en consultar!"
            : "Aún no hay temas publicados en esta sección."}
        </p>
      ) : (
        <ul className="mt-4 space-y-4">
          {visibles.map((t) => (
            <li key={t.id} className="rounded-xl border bg-background p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold">{t.titulo}</h3>
                    {t.resuelto ? (
                      <Pildora color="verde">
                        <CheckCircle2Icon className="mr-1 size-3" /> Resuelto
                      </Pildora>
                    ) : (
                      <Pildora color="ambar">Abierto</Pildora>
                    )}
                    {!enLeccion && t.contenidoTitulo && (
                      <Pildora color="gris">Lección: {t.contenidoTitulo}</Pildora>
                    )}
                  </div>
                  <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{t.autorNombre}</span>
                    {t.esInstructor && (
                      <span className="inline-flex items-center gap-0.5 rounded-md bg-brand-50 px-1.5 py-0.5 text-[11px] font-medium text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                        <ShieldCheckIcon className="size-3" /> Docente
                      </span>
                    )}
                    <span>· {formatearFechaHora(t.creadoEn)}</span>
                  </p>
                </div>

                <div className="flex items-center gap-1">
                  {t.puedeResolver && (
                    <BotonAccion
                      accion={alternarTemaResuelto}
                      campos={{ id: t.id, resuelto: String(!t.resuelto) }}
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                    >
                      {t.resuelto ? (
                        <>
                          <RotateCcwIcon className="size-3" /> Reabrir
                        </>
                      ) : (
                        <>
                          <CheckCircle2Icon className="size-3" /> Marcar resuelto
                        </>
                      )}
                    </BotonAccion>
                  )}
                  {(t.propio || t.puedeResolver) && (
                    <BotonAccion
                      accion={eliminarTemaForo}
                      campos={{ id: t.id }}
                      confirmar={`¿Eliminar el hilo «${t.titulo}»?`}
                      variant="ghost"
                      size="icon-sm"
                      className="text-red-600 dark:text-red-400"
                      aria-label={`Eliminar ${t.titulo}`}
                    >
                      <Trash2Icon className="size-3.5" />
                    </BotonAccion>
                  )}
                </div>
              </div>

              <p className="mt-2.5 text-sm leading-relaxed whitespace-pre-line">{t.cuerpo}</p>

              {t.respuestas.length > 0 && (
                <ul className="mt-3 space-y-2 border-t pt-3">
                  {t.respuestas.map((r) => (
                    <li
                      key={r.id}
                      className={cn(
                        "rounded-lg px-3 py-2 text-xs",
                        r.esInstructor
                          ? "border border-brand-200 bg-brand-50/50 dark:border-brand-500/30 dark:bg-brand-500/10"
                          : "bg-muted/50",
                      )}
                    >
                      <div className="flex flex-wrap items-center gap-1.5 text-muted-foreground">
                        <span className="font-semibold text-foreground">{r.autorNombre}</span>
                        {r.esInstructor && (
                          <span className="inline-flex items-center gap-0.5 rounded-md bg-brand-100 px-1.5 py-0.5 text-[10px] font-semibold text-brand-800 dark:bg-brand-500/20 dark:text-brand-200">
                            <ShieldCheckIcon className="size-2.5" /> Docente
                          </span>
                        )}
                        <span>· {formatearFechaHora(r.creadoEn)}</span>
                      </div>
                      <p className="mt-1 text-sm whitespace-pre-line text-foreground">{r.texto}</p>
                    </li>
                  ))}
                </ul>
              )}

              <FormularioRespuesta temaId={t.id} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
