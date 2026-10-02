"use client";

import { CircleAlertIcon, CircleCheckIcon, CreditCardIcon, DownloadIcon, LoaderCircleIcon, ShieldCheckIcon, TimerOffIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { toast } from "sonner";
import { Pildora } from "@/components/comunes";
import { Button, buttonVariants } from "@/components/ui/button";
import { reservaVencida } from "@/config/matricula";
import type { Autenticacion3DS } from "@/lib/pagos/tipos";
import { formatearFechaHora, formatearSoles } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { cobrarConToken, estadoDelPago, prepararPagoEnLinea, type DatosCheckout } from "./pago-en-linea";

type Estado = "inactivo" | "preparando" | "checkout" | "procesando" | "3ds" | "esperando" | "aprobado" | "rechazado" | "error";

const ESPERA_MS = 5_000;
const ESPERA_MAXIMA_MS = 10 * 60 * 1000;

const TEXTO: Record<Estado, string> = {
  inactivo: "",
  preparando: "Preparando el pago…",
  checkout: "Completa el pago en la ventana de Culqi.",
  procesando: "Procesando tu pago…",
  "3ds": "Tu banco pide verificar la compra. Sigue sus indicaciones.",
  esperando: "Esperando la confirmación de tu billetera o banco. No cierres esta página.",
  aprobado: "¡Pago aprobado! Tu matrícula está confirmada.",
  rechazado: "",
  error: "",
};

interface Props {
  pagoId: string;
  curso: string;
  codigo: string;
  monto: number;
  venceEn: string | null;
  /** Abre el checkout apenas carga (al llegar desde la inscripción). */
  abrirAlCargar?: boolean;
  /** Motivo del último rechazo, guardado en el pago. */
  observacion?: string | null;
}

/**
 * HU-12 · Pago en línea con Culqi Checkout Custom: tarjeta y Yape (token → cargo en el
 * servidor, con verificación 3DS si el banco la pide) y billeteras, banca móvil o
 * agentes (orden confirmada por webhook, que esta pantalla espera consultando el estado).
 */
export function PagoEnLinea({ pagoId, curso, codigo, monto, venceEn, abrirAlCargar, observacion }: Props) {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>("inactivo");
  const [mensaje, setMensaje] = useState<string | null>(observacion ?? null);
  const [comprobanteId, setComprobanteId] = useState<number | null>(null);
  const [listo, setListo] = useState(false);
  const datos = useRef<DatosCheckout | null>(null);
  const token = useRef<string | null>(null);
  const abierto = useRef(false);
  const vencida = reservaVencida({ estado: "PENDIENTE", vence_en: venceEn });

  const fallar = (tipo: "rechazado" | "error", texto: string) => {
    setEstado(tipo);
    setMensaje(texto);
  };

  const aprobado = async () => {
    setEstado("aprobado");
    setMensaje(null);
    toast.success(TEXTO.aprobado);
    const r = await estadoDelPago(pagoId);
    setComprobanteId(r.comprobanteId);
    router.refresh();
  };

  const cobrar = async (id: string, autenticacion3DS?: Autenticacion3DS) => {
    setEstado("procesando");
    const huella = (await window.Culqi3DS?.generateDevice().catch(() => null)) ?? undefined;
    const r = await cobrarConToken({ pagoId, token: id, huella, autenticacion3DS });
    if (r.estado === "APROBADO") return aprobado();
    if (r.estado === "REQUIERE_3DS") return verificarConBanco(id);
    fallar(r.estado === "RECHAZADO" ? "rechazado" : "error", r.mensaje);
  };

  const verificarConBanco = (id: string) => {
    const tresDS = window.Culqi3DS;
    if (!tresDS || !datos.current) return fallar("error", "No pudimos iniciar la verificación de tu banco. Intenta de nuevo.");
    setEstado("3ds");
    tresDS.publicKey = datos.current.llavePublica;
    tresDS.settings = { charge: { totalAmount: datos.current.montoCentimos, returnUrl: window.location.href }, card: { email: datos.current.correo } };
    tresDS.options = { showModal: true, showLoading: true, showIcon: true, style: { btnColor: "#0E7490", btnTextColor: "#FFFFFF" } };
    tresDS.initAuthentication(id);
  };

  const abrir = async () => {
    if (!window.CulqiCheckout) return fallar("error", "No se pudo cargar el formulario de pago. Recarga la página.");
    setEstado("preparando");
    setMensaje(null);
    const r = await prepararPagoEnLinea(pagoId);
    if (!r.ok) return fallar("error", r.mensaje);
    datos.current = r.checkout;
    const checkout = new window.CulqiCheckout(r.checkout.llavePublica, {
      settings: { title: "PEDSAR", currency: "PEN", amount: r.checkout.montoCentimos, order: r.checkout.ordenId },
      client: { email: r.checkout.correo, firstName: r.checkout.nombres, lastName: r.checkout.apellidos },
      options: {
        lang: "auto",
        installments: false,
        modal: true,
        paymentMethods: { tarjeta: true, yape: true, billetera: true, bancaMovil: true, agente: true, cuotealo: false },
        paymentMethodsSort: ["tarjeta", "yape", "billetera", "bancaMovil", "agente"],
      },
      appearance: { theme: "default", menuType: "sidebar", defaultStyle: { bannerColor: "#0E7490", buttonBackground: "#0E7490", menuColor: "#0E7490" } },
    });
    checkout.culqi = () => {
      if (checkout.token) {
        token.current = checkout.token.id;
        checkout.close();
        void cobrar(checkout.token.id);
      } else if (checkout.order) {
        checkout.close();
        setEstado("esperando");
      } else if (checkout.error) {
        fallar("rechazado", checkout.error.user_message ?? "No se pudo completar el pago");
      }
    };
    setEstado("checkout");
    checkout.open();
  };

  // Verificación 3DS: Culqi3DS responde con un mensaje de la misma ventana.
  const alMensaje = useEffectEvent((event: MessageEvent) => {
    if (event.origin !== window.location.origin || estado !== "3ds") return;
    const { parameters3DS, error } = (event.data ?? {}) as { parameters3DS?: Autenticacion3DS; error?: string };
    if (parameters3DS && token.current) void cobrar(token.current, parameters3DS);
    else if (error) fallar("error", `Tu banco no pudo verificar la compra: ${error}`);
  });
  useEffect(() => {
    const escuchar = (e: MessageEvent) => alMensaje(e);
    window.addEventListener("message", escuchar);
    return () => window.removeEventListener("message", escuchar);
  }, []);

  // Al llegar desde la inscripción, el checkout se abre solo una vez.
  const abrirSolo = useEffectEvent(() => {
    if (abierto.current || !abrirAlCargar || vencida) return;
    abierto.current = true;
    void abrir();
  });
  useEffect(() => {
    if (listo) abrirSolo();
  }, [listo]);

  // Billetera, banca móvil o agente: se espera el webhook consultando el estado.
  const consultar = useEffectEvent(async () => {
    const r = await estadoDelPago(pagoId);
    if (r.estado === "APROBADO") await aprobado();
  });
  useEffect(() => {
    if (estado !== "esperando") return;
    const inicio = Date.now();
    const intervalo = setInterval(() => {
      if (Date.now() - inicio > ESPERA_MAXIMA_MS) {
        clearInterval(intervalo);
        fallar("error", "Aún no recibimos la confirmación. Si ya pagaste, la verás en unos minutos en esta página.");
        return;
      }
      void consultar();
    }, ESPERA_MS);
    return () => clearInterval(intervalo);
  }, [estado]);

  const ocupado = ["preparando", "checkout", "procesando", "3ds", "esperando"].includes(estado);
  const texto = estado === "rechazado" || estado === "error" || estado === "inactivo" ? mensaje : TEXTO[estado];

  return (
    <section aria-labelledby={`pago-linea-${pagoId}`} className="animar-escala overflow-hidden rounded-2xl border bg-card shadow-xs">
      <Script src="https://js.culqi.com/checkout-js" onReady={() => setListo(true)} />
      <Script src="https://3ds.culqi.com" />
      <div className="flex flex-wrap items-start justify-between gap-3 border-b p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-linear-to-br from-brand-600 to-brand-800 text-white">
            <CreditCardIcon className="size-5" />
          </span>
          <div>
            <h2 id={`pago-linea-${pagoId}`} className="font-semibold">
              {estado === "aprobado" ? "Pago aprobado" : vencida ? "Reserva vencida" : "Completa tu pago"} · {curso}
            </h2>
            <p className="text-sm text-muted-foreground">
              Inscripción <span className="font-mono">{codigo}</span> · Pago en línea · {formatearSoles(monto)}
            </p>
          </div>
        </div>
        {estado === "aprobado" ? (
          <Pildora color="verde">
            <CircleCheckIcon /> Aprobado
          </Pildora>
        ) : vencida ? (
          <Pildora color="gris">
            <TimerOffIcon /> Vencida
          </Pildora>
        ) : (
          venceEn && <Pildora color="ambar">Pagar antes del {formatearFechaHora(venceEn)}</Pildora>
        )}
      </div>

      <div className="space-y-4 p-5">
        {texto && (
          <p
            aria-live="polite"
            className={cn(
              "flex items-start gap-2 rounded-xl p-3 text-sm",
              estado === "rechazado" || estado === "error" || (estado === "inactivo" && mensaje)
                ? "bg-red-50 text-red-800 dark:bg-red-500/10 dark:text-red-300"
                : estado === "aprobado"
                  ? "bg-green-50 text-green-800 dark:bg-green-500/10 dark:text-green-300"
                  : "bg-muted/60 text-muted-foreground",
            )}
          >
            {ocupado ? (
              <LoaderCircleIcon className="mt-0.5 size-4 shrink-0 animate-spin" />
            ) : estado === "aprobado" ? (
              <CircleCheckIcon className="mt-0.5 size-4 shrink-0" />
            ) : (
              <CircleAlertIcon className="mt-0.5 size-4 shrink-0" />
            )}
            <span>{estado === "inactivo" && mensaje ? `Tu último intento no se aprobó: ${mensaje}` : texto}</span>
          </p>
        )}

        {estado === "aprobado" ? (
          comprobanteId && (
            <a href={`/comprobantes/${comprobanteId}/pdf`} className={buttonVariants({ variant: "outline", className: "h-10" })}>
              <DownloadIcon /> Descargar comprobante
            </a>
          )
        ) : vencida ? (
          <p className="text-sm text-muted-foreground">Tu reserva venció. Si aún hay cupos, vuelve a inscribirte desde el catálogo.</p>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={() => void abrir()} disabled={!listo || ocupado} className="h-10 px-5">
              <CreditCardIcon /> {estado === "rechazado" || estado === "error" ? "Intentar de nuevo" : "Pagar en línea"}
            </Button>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheckIcon className="size-3.5 text-green-600" /> Tarjeta, Yape, Plin u otras billeteras · procesado por Culqi
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
