"use client";

import { CheckCheckIcon, CheckIcon, SendHorizontalIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useEffectEvent, useRef, useState } from "react";
import { toast } from "sonner";
import { AvatarIniciales } from "@/components/comunes";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { EstadoFormulario } from "@/features/usuarios/esquemas";
import { formatearFechaHora } from "@/lib/formato";
import { cn } from "@/lib/utils";
import type { Mensaje } from "./consultas";
import { enviarMensaje, marcarLeidos } from "./mensajes";

const REFRESCO_MS = 10_000;
const MAXIMO = 2000;

interface Props {
  /** null si el estudiante aún no escribió en este curso. */
  conversacionId: number | null;
  /** Curso del chat (el estudiante escribe por curso; el instructor, por conversación). */
  cursoId: string;
  rol: "estudiante" | "instructor";
  otro: string;
  mensajes: Mensaje[];
}

/**
 * HU-19 · Conversación privada estudiante–instructor. Se actualiza cada 10 s mientras está
 * abierta (no es tiempo real) y marca como leídos los mensajes recibidos.
 */
export function Conversacion({ conversacionId, cursoId, rol, otro, mensajes }: Props) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const formulario = useRef<HTMLFormElement>(null);
  const final = useRef<HTMLLIElement>(null);
  const [, enviar, enviando] = useActionState(async (previo: EstadoFormulario, datos: FormData) => {
    const r = await enviarMensaje(previo, datos);
    if (r.ok) {
      setTexto("");
      router.refresh();
    } else toast.error(r.mensaje);
    return r;
  }, {});

  const sinLeer = mensajes.some((m) => !m.propio && !m.leido);
  const ultimo = mensajes.at(-1)?.id;

  // Al abrir y cuando llegan mensajes nuevos: se marcan como leídos y se baja al último.
  const leer = useEffectEvent(() => {
    final.current?.scrollIntoView({ block: "end" });
    if (conversacionId && sinLeer) void marcarLeidos(conversacionId);
  });
  useEffect(() => leer(), [ultimo]);

  useEffect(() => {
    const intervalo = setInterval(() => router.refresh(), REFRESCO_MS);
    return () => clearInterval(intervalo);
  }, [router]);

  return (
    <section className="flex h-[min(70vh,640px)] flex-col overflow-hidden rounded-2xl border bg-card shadow-xs" aria-label={`Conversación con ${otro}`}>
      <ol className="flex-1 space-y-3 overflow-y-auto p-5" aria-live="polite">
        {mensajes.length === 0 && (
          <li className="py-10 text-center text-sm text-muted-foreground">
            {rol === "estudiante" ? `Escribe tu primera consulta a ${otro}. Te responderá por aquí.` : "Aún no hay mensajes."}
          </li>
        )}
        {mensajes.map((m) => (
          <li key={m.id} className={cn("flex items-end gap-2", m.propio && "justify-end")}>
            {!m.propio && <AvatarIniciales nombre={otro} className="size-7 text-[10px]" />}
            <div
              className={cn(
                "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm shadow-xs",
                m.propio ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-muted text-foreground",
              )}
            >
              <p className="break-words whitespace-pre-wrap">{m.texto}</p>
              <p className={cn("mt-1 flex items-center justify-end gap-1 text-[10px]", m.propio ? "text-primary-foreground/70" : "text-muted-foreground")}>
                {formatearFechaHora(m.enviadoEn)}
                {m.propio &&
                  (m.leido ? (
                    <CheckCheckIcon className="size-3" aria-label="Leído" />
                  ) : (
                    <CheckIcon className="size-3" aria-label="Enviado" />
                  ))}
              </p>
            </div>
          </li>
        ))}
        <li ref={final} aria-hidden />
      </ol>

      <form ref={formulario} action={enviar} className="border-t p-3">
        {rol === "estudiante" ? <input type="hidden" name="cursoId" value={cursoId} /> : <input type="hidden" name="conversacionId" value={conversacionId ?? ""} />}
        <label htmlFor="texto-mensaje" className="sr-only">
          Mensaje para {otro}
        </label>
        <div className="flex items-end gap-2">
          <Textarea
            id="texto-mensaje"
            name="texto"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                formulario.current?.requestSubmit();
              }
            }}
            maxLength={MAXIMO}
            rows={2}
            placeholder={`Escribe a ${otro}…`}
            className="max-h-40 min-h-11 resize-none"
          />
          <Button type="submit" size="icon" className="size-11 shrink-0" disabled={enviando || !texto.trim()} aria-label="Enviar mensaje">
            <SendHorizontalIcon />
          </Button>
        </div>
        <p className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
          <span>Ctrl + Enter para enviar</span>
          <span className="tabular-nums">
            {texto.length}/{MAXIMO}
          </span>
        </p>
      </form>
    </section>
  );
}
