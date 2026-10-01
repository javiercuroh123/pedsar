"use client";

import { CircleAlertIcon, ClockIcon, ImageUpIcon, SmartphoneIcon, TimerOffIcon } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { toast } from "sonner";
import { BotonCopiar } from "@/components/boton-copiar";
import { Pildora } from "@/components/comunes";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EMPRESA } from "@/config/empresa";
import { reservaVencida } from "@/config/matricula";
import type { EstadoFormulario } from "@/features/usuarios/esquemas";
import { formatearFecha, formatearFechaHora, formatearSoles } from "@/lib/formato";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { registrarPagoManual } from "./acciones";

/** Tipos que acepta el bucket "vouchers" y la extensión con que se guardan. */
const TIPOS_CAPTURA: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };
const LIMITE_MB = 5;

export interface PagoPorCompletar {
  id: string;
  metodo: "YAPE" | "PLIN";
  monto: number;
  numero_operacion: string | null;
  reportado_en: string | null;
  observacion: string | null;
  /** Plazo de la reserva (de la inscripción). */
  vence_en: string | null;
}

function Paso({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 font-mono text-xs font-bold text-primary">{n}</span>
      <div className="min-w-0">{children}</div>
    </li>
  );
}

/**
 * CU «Registrar pago manual» · instrucciones para pagar por Yape / Plin y
 * formulario del N.º de operación con la captura opcional. La captura va directo
 * del navegador al bucket privado "vouchers" (carpeta del estudiante) y la Server
 * Action solo registra su ruta.
 */
export function PagoManual({
  estudianteId,
  pago,
  curso,
  codigo,
}: {
  estudianteId: string;
  pago: PagoPorCompletar;
  curso: { titulo: string; slug: string };
  codigo: string;
}) {
  const reportado = Boolean(pago.reportado_en);
  const vencida = !reportado && reservaVencida({ estado: "PENDIENTE", vence_en: pago.vence_en });
  const [editando, setEditando] = useState(!reportado);
  const [archivo, setArchivo] = useState<File | null>(null);
  const app = pago.metodo === "YAPE" ? "Yape" : "Plin";
  const { celular, titular } = EMPRESA.pagoDirecto;

  const [, enviar, pendiente] = useActionState(async (previo: EstadoFormulario, datos: FormData) => {
    if (archivo) {
      const extension = TIPOS_CAPTURA[archivo.type];
      if (!extension || archivo.size > LIMITE_MB * 1024 * 1024) {
        toast.error(`La captura debe ser JPG, PNG, WebP o PDF de hasta ${LIMITE_MB} MB`);
        return { ok: false };
      }
      const ruta = `${estudianteId}/${pago.id}-${Date.now()}.${extension}`;
      const { error } = await createClient().storage.from("vouchers").upload(ruta, archivo, { contentType: archivo.type });
      if (error) {
        toast.error(`No se pudo subir la captura: ${error.message}`);
        return { ok: false };
      }
      datos.set("voucher", ruta);
    }
    const r = await registrarPagoManual(previo, datos);
    if (r.ok) {
      toast.success(r.mensaje);
      setArchivo(null);
      setEditando(false);
    } else toast.error(r.mensaje);
    return r;
  }, {});

  return (
    <section aria-labelledby={`pago-${pago.id}`} className="animar-escala overflow-hidden rounded-2xl border bg-card shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b p-5">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "grid size-10 shrink-0 place-items-center rounded-lg bg-linear-to-br text-white",
              pago.metodo === "YAPE" ? "from-[#742284] to-[#9b3cb0]" : "from-[#00a7b8] to-[#00c7a0]",
            )}
          >
            <SmartphoneIcon className="size-5" />
          </span>
          <div>
            <h2 id={`pago-${pago.id}`} className="font-semibold">
              {reportado ? "Pago en validación" : vencida ? "Reserva vencida" : "Completa tu pago"} · {curso.titulo}
            </h2>
            <p className="text-sm text-muted-foreground">
              Inscripción <span className="font-mono">{codigo}</span> · {app} · {formatearSoles(pago.monto)}
            </p>
          </div>
        </div>
        {reportado ? (
          <Pildora color="indigo">
            <ClockIcon /> En validación
          </Pildora>
        ) : vencida ? (
          <Pildora color="gris">
            <TimerOffIcon /> Vencida
          </Pildora>
        ) : (
          <Pildora color="ambar">{pago.vence_en ? `Paga antes del ${formatearFechaHora(pago.vence_en)}` : "Falta registrar el pago"}</Pildora>
        )}
      </div>

      {vencida ? (
        <div className="flex flex-wrap items-center justify-between gap-3 p-5 text-sm">
          <p className="max-w-prose text-muted-foreground">
            El plazo para registrar el pago terminó el {formatearFechaHora(pago.vence_en!)} y liberamos tu cupo. Si aún hay vacantes, vuelve a
            inscribirte; si ya habías pagado, registra el N.º de operación en la nueva inscripción.
          </p>
          <Link href={`/cursos/${curso.slug}/inscripcion`} className={buttonVariants({ size: "sm" })}>
            Volver a inscribirme
          </Link>
        </div>
      ) : null}

      {!vencida && pago.observacion && !reportado && (
        <p role="alert" className="mx-5 mt-5 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          <CircleAlertIcon className="mt-0.5 size-4 shrink-0" />
          <span>
            <b className="font-semibold">Revisamos tu pago:</b> {pago.observacion}
          </span>
        </p>
      )}

      {vencida ? null : reportado && !editando ? (
        <div className="flex flex-wrap items-center justify-between gap-3 p-5 text-sm">
          <p className="text-muted-foreground">
            Registraste la operación <span className="font-mono font-medium text-foreground">{pago.numero_operacion}</span> el{" "}
            {formatearFecha(pago.reportado_en!)}. Confirmaremos tu matrícula en cuanto la verifiquemos.
          </p>
          <Button type="button" variant="outline" size="sm" onClick={() => setEditando(true)}>
            Corregir datos
          </Button>
        </div>
      ) : (
        <div className="grid gap-6 p-5 md:grid-cols-2">
          <ol className="space-y-4 text-sm">
            <Paso n={1}>
              <p className="font-medium">
                {pago.metodo === "YAPE" ? "Yapea" : "Envía por Plin"} {formatearSoles(pago.monto)} a {titular}
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-1">
                <span className="font-mono text-base tracking-wide">{celular}</span>
                <BotonCopiar texto={celular.replace(/\s/g, "")} etiqueta="Copiar número" />
              </p>
            </Paso>
            <Paso n={2}>
              <p>
                En la constancia de {app} busca el <b className="font-medium">N.º de operación</b> y escríbelo aquí. Si puedes, adjunta la captura.
              </p>
            </Paso>
            <Paso n={3}>
              <p className="text-muted-foreground">Validamos el pago, confirmamos tu matrícula y te avisamos con una notificación.</p>
            </Paso>
          </ol>

          <form action={enviar} className="space-y-4">
            <input type="hidden" name="pagoId" value={pago.id} />
            <div className="space-y-1.5">
              <Label htmlFor={`operacion-${pago.id}`}>N.º de operación</Label>
              <Input
                id={`operacion-${pago.id}`}
                name="numeroOperacion"
                required
                maxLength={40}
                autoComplete="off"
                inputMode={pago.metodo === "YAPE" ? "numeric" : undefined}
                defaultValue={pago.numero_operacion ?? ""}
                placeholder="Ej. 12345678"
                className="h-10 font-mono uppercase"
              />
            </div>
            <label className="flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed px-4 py-5 text-center transition has-focus-visible:ring-3 has-focus-visible:ring-ring/50 hover:border-brand-400 hover:bg-brand-50/40 dark:hover:bg-brand-500/5">
              <ImageUpIcon className="size-6 text-primary" />
              <span className="mt-2 text-sm font-medium">{archivo ? archivo.name : "Adjuntar captura (opcional)"}</span>
              <span className="text-xs text-muted-foreground">JPG, PNG, WebP o PDF · máximo {LIMITE_MB} MB</span>
              <input
                type="file"
                accept={Object.keys(TIPOS_CAPTURA).join(",")}
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  if (f && f.size > LIMITE_MB * 1024 * 1024) toast.error(`La captura supera ${LIMITE_MB} MB`);
                  setArchivo(f);
                }}
              />
            </label>
            <div className="flex justify-end gap-2">
              {reportado && (
                <Button type="button" variant="ghost" onClick={() => setEditando(false)}>
                  Cancelar
                </Button>
              )}
              <Button type="submit" disabled={pendiente}>
                {pendiente ? "Enviando…" : "Registrar pago"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
