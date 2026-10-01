"use client";

import {
  ArrowLeftIcon,
  ArrowRightIcon,
  AwardIcon,
  CheckIcon,
  CircleCheckIcon,
  CreditCardIcon,
  LockIcon,
  ReceiptIcon,
  ShieldCheckIcon,
  SmartphoneIcon,
  TicketPercentIcon,
} from "lucide-react";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { BotonEnviar } from "@/components/boton-enviar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SiglaCurso } from "@/features/catalogo/portada-curso";
import { formatearSoles } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { inscribirse, validarCupon } from "./acciones";

const METODOS = [
  { valor: "CULQI", titulo: "Tarjeta", detalle: "Visa, Mastercard, Amex", icono: CreditCardIcon, color: "from-brand-600 to-brand-800" },
  { valor: "YAPE", titulo: "Yape", detalle: "Código de aprobación", icono: SmartphoneIcon, color: "from-[#742284] to-[#9b3cb0]" },
  { valor: "PLIN", titulo: "Plin", detalle: "Pago con QR", icono: SmartphoneIcon, color: "from-[#00a7b8] to-[#00c7a0]" },
] as const;

const PASOS = ["Datos", "Pago", "Confirmación"];

interface Props {
  curso: { id: string; titulo: string; precio: number; categoria: string | null; resumen: string; horario: string };
  perfil: { nombres: string; apellidos: string; correo: string; telefono: string | null; documento: string | null };
  cupoLibre: number;
  cupoMaximo: number;
}

export function FormularioInscripcion({ curso, perfil, cupoLibre, cupoMaximo }: Props) {
  const [paso, setPaso] = useState(1);
  const [metodo, setMetodo] = useState<string>("CULQI");
  const [comprobante, setComprobante] = useState<"BOLETA" | "FACTURA">("BOLETA");
  const [cupon, setCupon] = useState<{ codigo: string; porcentaje: number } | null>(null);
  const [textoCupon, setTextoCupon] = useState("");
  const [validando, iniciar] = useTransition();
  const datosRef = useRef<HTMLFieldSetElement>(null);

  const descuento = cupon ? Math.round(curso.precio * cupon.porcentaje) / 100 : 0;
  const total = curso.precio - descuento;

  const continuar = () => {
    const campos = datosRef.current?.querySelectorAll<HTMLInputElement>("input") ?? [];
    for (const c of campos) if (!c.reportValidity()) return;
    setPaso(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const aplicarCupon = () =>
    iniciar(async () => {
      const r = await validarCupon(textoCupon);
      if (r.ok && r.porcentaje) {
        setCupon({ codigo: textoCupon.trim().toUpperCase(), porcentaje: r.porcentaje });
        toast.success(r.mensaje);
      } else {
        setCupon(null);
        toast.error(r.mensaje);
      }
    });

  return (
    <>
      <ol className="mt-6 flex items-center gap-3 text-sm" aria-label="Pasos de la inscripción">
        {PASOS.map((p, i) => {
          const n = i + 1;
          const hecho = n < paso;
          const actual = n === paso;
          return (
            <li key={p} className="flex items-center gap-3">
              {i > 0 && (
                <span className="relative h-0.5 w-8 overflow-hidden rounded-full bg-border sm:w-16">
                  <span
                    className={cn(
                      "absolute inset-y-0 left-0 rounded-full bg-green-600 transition-[width] duration-500 ease-(--ease-salida)",
                      hecho || actual ? "w-full" : "w-0",
                    )}
                  />
                </span>
              )}
              <span className="flex items-center gap-2" aria-current={actual ? "step" : undefined}>
                <span
                  className={cn(
                    "grid size-8 place-items-center rounded-full font-mono text-xs font-bold transition",
                    hecho && "bg-green-600 text-white",
                    actual && "bg-primary text-primary-foreground shadow-md shadow-primary/30 ring-4 ring-primary/15",
                    !hecho && !actual && "border bg-card text-muted-foreground",
                  )}
                >
                  {hecho ? <CheckIcon className="size-4" /> : n}
                </span>
                <span className={cn("font-medium", !actual && !hecho && "text-muted-foreground")}>{p}</span>
              </span>
            </li>
          );
        })}
      </ol>

      <form action={inscribirse} className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <input type="hidden" name="cursoId" value={curso.id} />
        <input type="hidden" name="cupon" value={cupon?.codigo ?? ""} />

        <div className="min-w-0 space-y-6">
          {/* Paso 1 · Datos */}
          <fieldset ref={datosRef} hidden={paso !== 1} className="rounded-2xl border bg-card p-6 shadow-xs">
            <legend className="sr-only">Datos del estudiante</legend>
            <h2 className="text-lg font-semibold">Datos del estudiante</h2>
            <p className="text-sm text-muted-foreground">Verifica tus datos; los usaremos en tu certificado y comprobante.</p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Nombres</Label>
                <Input value={perfil.nombres} readOnly className="h-10 bg-muted/50" />
              </div>
              <div className="space-y-1.5">
                <Label>Apellidos</Label>
                <Input value={perfil.apellidos} readOnly className="h-10 bg-muted/50" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="documento">DNI</Label>
                <Input
                  id="documento"
                  name="documento"
                  required
                  inputMode="numeric"
                  pattern="[0-9]{8}"
                  maxLength={8}
                  title="8 dígitos"
                  defaultValue={perfil.documento ?? ""}
                  className="h-10 font-mono"
                />
                <p className="text-xs text-muted-foreground">8 dígitos</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="telefono">Celular</Label>
                <Input
                  id="telefono"
                  name="telefono"
                  required
                  inputMode="tel"
                  pattern="[0-9 +]{9,15}"
                  title="Número de celular"
                  defaultValue={perfil.telefono ?? ""}
                  placeholder="9XX XXX XXX"
                  className="h-10 font-mono"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Correo electrónico</Label>
                <Input value={perfil.correo} readOnly className="h-10 bg-muted/50" />
                <p className="text-xs text-muted-foreground">Aquí enviaremos la confirmación y el comprobante.</p>
              </div>
            </div>
            <div className="mt-6 grid gap-3 rounded-xl bg-green-50 p-4 text-sm sm:grid-cols-2 dark:bg-green-500/10">
              <p className="flex items-start gap-2">
                <CircleCheckIcon className="mt-0.5 size-4 shrink-0 text-green-600 dark:text-green-400" />
                <span>
                  <b className="font-semibold">Cupo disponible</b>
                  <br />
                  <span className="text-muted-foreground">
                    {cupoLibre} de {cupoMaximo} cupos libres
                  </span>
                </span>
              </p>
              <p className="flex items-start gap-2">
                <CircleCheckIcon className="mt-0.5 size-4 shrink-0 text-green-600 dark:text-green-400" />
                <span>
                  <b className="font-semibold">Pago seguro</b>
                  <br />
                  <span className="text-muted-foreground">Conexión cifrada HTTPS/TLS</span>
                </span>
              </p>
            </div>
            <label className="mt-6 flex items-start gap-3 text-sm">
              <input type="checkbox" required className="mt-0.5 size-4" />
              <span className="text-muted-foreground">
                Acepto los{" "}
                <Link href="/privacidad" className="font-medium text-primary hover:underline">
                  términos y condiciones
                </Link>{" "}
                y autorizo el tratamiento de mis datos personales conforme a la Ley N.º 29733.
              </span>
            </label>
            <div className="mt-6 flex justify-end">
              <Button type="button" onClick={continuar} className="h-10 px-5">
                Continuar al pago <ArrowRightIcon />
              </Button>
            </div>
          </fieldset>

          {/* Paso 2 · Pago */}
          <div hidden={paso !== 2} className="space-y-6">
            <fieldset className="rounded-2xl border bg-card p-6 shadow-xs">
              <legend className="sr-only">Método de pago</legend>
              <h2 className="text-lg font-semibold">Método de pago</h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {METODOS.map((m) => (
                  <label
                    key={m.valor}
                    className={cn(
                      "relative flex cursor-pointer flex-col gap-2 rounded-xl border p-4 transition-all duration-200 has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                      metodo === m.valor
                        ? "border-primary bg-brand-50 ring-1 ring-primary dark:bg-brand-500/10"
                        : "hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md",
                    )}
                  >
                    <input
                      type="radio"
                      name="metodo"
                      value={m.valor}
                      checked={metodo === m.valor}
                      onChange={() => setMetodo(m.valor)}
                      className="sr-only"
                    />
                    <span className={cn("grid size-9 place-items-center rounded-lg bg-linear-to-br text-white", m.color)}>
                      <m.icono className="size-4.5" />
                    </span>
                    <span className="text-sm font-semibold">{m.titulo}</span>
                    <span className="text-xs text-muted-foreground">{m.detalle}</span>
                    {metodo === m.valor && (
                      <span className="animar-escala absolute top-3 right-3 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground">
                        <CheckIcon className="size-3" />
                      </span>
                    )}
                  </label>
                ))}
              </div>
              <div className="mt-6 rounded-xl bg-muted/60 p-4 text-sm text-muted-foreground">
                {metodo === "CULQI" && (
                  <p className="flex items-start gap-2">
                    <LockIcon className="mt-0.5 size-4 shrink-0 text-primary" />
                    Al confirmar se abrirá la pasarela segura para ingresar los datos de tu tarjeta. PEDSAR no almacena los datos de tu
                    tarjeta.
                  </p>
                )}
                {metodo === "YAPE" && (
                  <p>
                    Abre Yape › Menú › <b className="text-foreground">Código de aprobación</b> y tenlo a mano: la pasarela te lo pedirá al
                    confirmar. El código vence en 2 minutos.
                  </p>
                )}
                {metodo === "PLIN" && <p>Al confirmar verás un código QR para pagar desde tu app bancaria compatible con Plin.</p>}
              </div>
            </fieldset>

            <fieldset className="rounded-2xl border bg-card p-6 shadow-xs">
              <legend className="sr-only">Comprobante electrónico</legend>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Comprobante electrónico</h2>
                <div className="inline-flex rounded-lg bg-muted p-1" role="radiogroup" aria-label="Tipo de comprobante">
                  {(["BOLETA", "FACTURA"] as const).map((t) => (
                    <label
                      key={t}
                      className={cn(
                        "cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                        comprobante === t ? "bg-background shadow-sm" : "text-muted-foreground",
                      )}
                    >
                      <input
                        type="radio"
                        name="comprobante"
                        value={t}
                        checked={comprobante === t}
                        onChange={() => setComprobante(t)}
                        className="sr-only"
                      />
                      {t === "BOLETA" ? "Boleta" : "Factura"}
                    </label>
                  ))}
                </div>
              </div>
              {comprobante === "BOLETA" ? (
                <p className="mt-3 text-sm text-muted-foreground">Se emitirá una boleta de venta electrónica a tu nombre y se enviará a tu correo.</p>
              ) : (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="ruc">RUC</Label>
                    <Input id="ruc" name="ruc" required inputMode="numeric" pattern="(10|20)[0-9]{9}" maxLength={11} placeholder="20XXXXXXXXX" className="h-10 font-mono" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="razonSocial">Razón social</Label>
                    <Input id="razonSocial" name="razonSocial" required placeholder="Empresa S.A.C." className="h-10" />
                  </div>
                </div>
              )}
            </fieldset>

            <div className="flex items-center justify-between">
              <Button type="button" variant="ghost" onClick={() => setPaso(1)} className="h-10">
                <ArrowLeftIcon /> Atrás
              </Button>
              <BotonEnviar
                pendiente="Procesando…"
                className="h-11 px-6 text-[0.95rem]"
              >
                <LockIcon /> Confirmar inscripción · {formatearSoles(total)}
              </BotonEnviar>
            </div>
          </div>
        </div>

        <aside className="animar-escala lg:sticky lg:top-24 lg:self-start [--i:2]">
          <div className="overflow-hidden rounded-2xl border bg-card shadow-md">
            <div className="flex gap-4 border-b p-5">
              <SiglaCurso titulo={curso.titulo} categoria={curso.categoria} className="size-14 text-base" />
              <div className="min-w-0">
                <p className="leading-snug font-semibold">{curso.titulo}</p>
                <p className="mt-1 text-xs text-muted-foreground">{curso.resumen}</p>
                <p className="text-xs text-muted-foreground">{curso.horario}</p>
              </div>
            </div>
            <div className="space-y-3 p-5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Precio del curso</span>
                <span className="tabular-nums">{formatearSoles(curso.precio)}</span>
              </div>
              {cupon && (
                <div className="animar-escala flex justify-between rounded-lg bg-green-50 px-3 py-2 text-green-700 dark:bg-green-500/10 dark:text-green-400">
                  <span>
                    Cupón {cupon.codigo} (−{cupon.porcentaje} %)
                  </span>
                  <span className="tabular-nums">− {formatearSoles(descuento)}</span>
                </div>
              )}
              <div className="flex items-baseline justify-between border-t pt-3">
                <span className="font-medium">Total a pagar</span>
                <span className="text-[1.875rem] font-semibold tracking-tight tabular-nums">{formatearSoles(total)}</span>
              </div>
              <div className="flex gap-2 pt-2">
                <label className="relative flex-1">
                  <span className="sr-only">Cupón de descuento</span>
                  <TicketPercentIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={textoCupon}
                    onChange={(e) => setTextoCupon(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        aplicarCupon();
                      }
                    }}
                    placeholder="Cupón de descuento"
                    className="h-9 pl-8 font-mono uppercase"
                  />
                </label>
                <Button type="button" variant="outline" className="h-9" disabled={validando} onClick={aplicarCupon}>
                  {validando ? "…" : "Aplicar"}
                </Button>
              </div>
            </div>
            <ul className="space-y-2 border-t bg-muted/40 p-5 text-xs text-muted-foreground">
              <li className="flex items-center gap-2">
                <ReceiptIcon className="size-3.5 text-brand-600 dark:text-brand-400" />
                Comprobante electrónico SUNAT
              </li>
              <li className="flex items-center gap-2">
                <AwardIcon className="size-3.5 text-rose-500" />
                Certificado digital con código verificable
              </li>
              <li className="flex items-center gap-2">
                <ShieldCheckIcon className="size-3.5 text-green-600" />
                Conexión cifrada HTTPS/TLS
              </li>
            </ul>
          </div>
        </aside>
      </form>
    </>
  );
}
