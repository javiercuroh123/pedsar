"use client";

import { CircleAlertIcon, CircleCheckIcon, CreditCardIcon, DownloadIcon, InfoIcon, LoaderCircleIcon, ShieldCheckIcon, SmartphoneIcon, TimerOffIcon } from "lucide-react";
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
import { cambiarAPagoDirecto, cobrarConToken, estadoDelPago, prepararPagoEnLinea, type DatosCheckout } from "./pago-en-linea";

type Estado = "inactivo" | "preparando" | "checkout" | "procesando" | "3ds" | "esperando" | "aviso" | "aprobado" | "rechazado" | "error";

const ESPERA_MS = 5_000;
const ESPERA_MAXIMA_MS = 10 * 60 * 1000;
const SIN_CONFIRMAR = "No pudimos confirmar el resultado. Si se te descontó, tu matrícula se confirmará sola en unos minutos; no vuelvas a pagar por ahora.";

const TEXTO: Partial<Record<Estado, string>> = {
  preparando: "Preparando el pago…",
  checkout: "Completa el pago en la ventana de Culqi. Si la cerraste, vuelve a abrirla.",
  procesando: "Procesando tu pago…",
  "3ds": "Tu banco pide verificar la compra. Sigue sus indicaciones.",
  esperando: "Esperando la confirmación de tu billetera, banca móvil o agente. Puedes dejar esta página abierta.",
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
  /** Se ofrece cambiar al pago directo por Yape o Plin si la pasarela falla (Tabla 12). */
  pagoManual?: boolean;
}

/**
 * HU-12 · Pago en línea con Culqi Checkout Custom: tarjeta y Yape (token → cargo en el
 * servidor, con verificación 3DS si el banco la pide) y billeteras, banca móvil o
 * agentes (orden confirmada por webhook, que esta pantalla espera consultando el estado).
 */
export function PagoEnLinea({ pagoId, curso, codigo, monto, venceEn, abrirAlCargar, observacion, pagoManual }: Props) {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>("inactivo");
  const [mensaje, setMensaje] = useState<string | null>(observacion ? `Tu último intento no se aprobó: ${observacion}` : null);
  const [comprobanteId, setComprobanteId] = useState<number | null>(null);
  const [listo, setListo] = useState(false);
  const [falloScript, setFalloScript] = useState(false);
  const datos = useRef<DatosCheckout | null>(null);
  const token = useRef<string | null>(null);
  const abierto = useRef(false);
  const vencida = reservaVencida({ estado: "PENDIENTE", vence_en: venceEn });

  const fallar = (tipo: "rechazado" | "error", texto: string) => {
    setEstado(tipo);
    setMensaje(texto);
  };

  const aprobado = async (texto: string) => {
    setEstado("aprobado");
    setMensaje(texto);
    toast.success(texto);
    try {
      setComprobanteId((await estadoDelPago(pagoId)).comprobanteId);
    } catch {
      // El enlace al comprobante también aparece en el historial al recargar.
    }
  };

  const cobrar = async (id: string, autenticacion3DS?: Autenticacion3DS) => {
    setEstado("procesando");
    try {
      const huella = (await window.Culqi3DS?.generateDevice().catch(() => null)) ?? undefined;
      const r = await cobrarConToken({ pagoId, token: id, huella, autenticacion3DS });
      if (r.estado === "APROBADO") return aprobado(r.mensaje);
      // Si el banco vuelve a pedir verificación después de hacerla, no se entra en bucle.
      if (r.estado === "REQUIERE_3DS" && !autenticacion3DS) return verificarConBanco(id);
      fallar(r.estado === "RECHAZADO" ? "rechazado" : "error", r.mensaje);
    } catch {
      fallar("error", SIN_CONFIRMAR);
    }
  };

  const verificarConBanco = (id: string) => {
    const tresDS = window.Culqi3DS;
    if (!tresDS || !datos.current) return fallar("error", "No pudimos iniciar la verificación de tu banco. Intenta de nuevo.");
    setEstado("3ds");
    tresDS.reset?.();
    tresDS.settings = { charge: { totalAmount: datos.current.montoCentimos, returnUrl: window.location.href }, card: { email: datos.current.correo } };
    tresDS.options = { showModal: true, showLoading: true, showIcon: true, style: { btnColor: "#0E7490", btnTextColor: "#FFFFFF" } };
    tresDS.initAuthentication(id);
  };

  const abrir = async () => {
    if (!window.CulqiCheckout) return fallar("error", "No se pudo cargar el formulario de pago. Recarga la página o desactiva el bloqueador de anuncios.");
    setEstado("preparando");
    setMensaje(null);
    let r: Awaited<ReturnType<typeof prepararPagoEnLinea>>;
    try {
      r = await prepararPagoEnLinea(pagoId);
    } catch {
      return fallar("error", "No pudimos preparar el pago. Intenta de nuevo en unos segundos.");
    }
    if (!r.ok) {
      if (r.aprobado) return aprobado(r.mensaje);
      return fallar("error", r.mensaje);
    }
    datos.current = r.checkout;
    // La huella del dispositivo (antifraude) necesita la llave pública antes del primer cargo.
    if (window.Culqi3DS) window.Culqi3DS.publicKey = r.checkout.llavePublica;
    // Sin orden (Culqi la rechazó), solo se ofrecen tarjeta y Yape.
    const conOrden = Boolean(r.checkout.ordenId);
    const checkout = new window.CulqiCheckout(r.checkout.llavePublica, {
      settings: { title: "PEDSAR", currency: "PEN", amount: r.checkout.montoCentimos, ...(conOrden ? { order: r.checkout.ordenId! } : {}) },
      client: { email: r.checkout.correo, firstName: r.checkout.nombres, lastName: r.checkout.apellidos },
      options: {
        lang: "auto",
        installments: false,
        modal: true,
        paymentMethods: { tarjeta: true, yape: true, billetera: conOrden, bancaMovil: conOrden, agente: conOrden, cuotealo: false },
        paymentMethodsSort: conOrden ? ["tarjeta", "yape", "billetera", "bancaMovil", "agente"] : ["tarjeta", "yape"],
      },
      appearance: { theme: "default", menuType: "sidebar", defaultStyle: { bannerColor: "#0E7490", buttonBackground: "#0E7490", menuColor: "#0E7490" } },
    });
    checkout.culqi = () => {
      if (checkout.token) {
        token.current = checkout.token.id;
        checkout.close();
        void cobrar(checkout.token.id);
      } else if (checkout.order) {
        // Billetera, banca móvil o agente: el checkout sigue mostrando el QR o el código de pago.
        setEstado("esperando");
        setMensaje(null);
      } else if (checkout.error) {
        fallar("rechazado", checkout.error.user_message ?? "No se pudo completar el pago");
      }
    };
    setEstado("checkout");
    checkout.open();
  };

  const pasarAPagoDirecto = async (metodo: "YAPE" | "PLIN") => {
    const r = await cambiarAPagoDirecto(pagoId, metodo);
    (r.ok ? toast.success : toast.error)(r.mensaje);
    if (r.ok) router.refresh();
  };

  // Verificación 3DS: Culqi3DS responde con un mensaje de la misma ventana.
  const alMensaje = useEffectEvent((event: MessageEvent) => {
    if (event.origin !== window.location.origin || estado !== "3ds") return;
    const { parameters3DS, error } = (event.data ?? {}) as { parameters3DS?: Autenticacion3DS; error?: unknown };
    if (parameters3DS && token.current) void cobrar(token.current, parameters3DS);
    else if (error) {
      const detalle = typeof error === "string" ? error : ((error as { message?: string })?.message ?? "intenta con otra tarjeta");
      fallar("error", `Tu banco no pudo verificar la compra: ${detalle}`);
    }
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
    try {
      const r = await estadoDelPago(pagoId);
      if (r.estado === "APROBADO") {
        await aprobado("¡Pago aprobado! Tu matrícula está confirmada.");
        router.refresh();
      }
    } catch {
      // Se reintenta en la siguiente consulta.
    }
  });
  useEffect(() => {
    if (estado !== "esperando") return;
    const inicio = Date.now();
    const intervalo = setInterval(() => {
      if (Date.now() - inicio > ESPERA_MAXIMA_MS) {
        clearInterval(intervalo);
        setEstado("aviso");
        setMensaje("Cuando pagues en el agente o por banca móvil, tu matrícula se confirmará sola. Puedes cerrar esta página: te avisaremos por correo.");
        return;
      }
      void consultar();
    }, ESPERA_MS);
    return () => clearInterval(intervalo);
  }, [estado]);

  // «checkout» no bloquea el botón: si el estudiante cerró la ventana de Culqi, puede reabrirla.
  const ocupado = ["preparando", "procesando", "3ds"].includes(estado);
  const conError = estado === "rechazado" || estado === "error" || (estado === "inactivo" && Boolean(mensaje));
  const texto = TEXTO[estado] ?? mensaje;

  return (
    <section aria-labelledby={`pago-linea-${pagoId}`} className="animar-escala overflow-hidden rounded-2xl border bg-card shadow-xs">
      <Script src="https://js.culqi.com/checkout-js" onReady={() => setListo(true)} onError={() => setFalloScript(true)} />
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
        {(texto || falloScript) && (
          <p
            aria-live="polite"
            className={cn(
              "flex items-start gap-2 rounded-xl p-3 text-sm",
              conError || falloScript
                ? "bg-red-50 text-red-800 dark:bg-red-500/10 dark:text-red-300"
                : estado === "aprobado"
                  ? "bg-green-50 text-green-800 dark:bg-green-500/10 dark:text-green-300"
                  : "bg-muted/60 text-muted-foreground",
            )}
          >
            {ocupado || estado === "esperando" ? (
              <LoaderCircleIcon className="mt-0.5 size-4 shrink-0 animate-spin" />
            ) : estado === "aprobado" ? (
              <CircleCheckIcon className="mt-0.5 size-4 shrink-0" />
            ) : estado === "aviso" || estado === "checkout" ? (
              <InfoIcon className="mt-0.5 size-4 shrink-0" />
            ) : (
              <CircleAlertIcon className="mt-0.5 size-4 shrink-0" />
            )}
            <span>{falloScript && !texto ? "No se pudo cargar el formulario de pago. Recarga la página o desactiva el bloqueador de anuncios." : texto}</span>
          </p>
        )}

        {estado === "aprobado" ? (
          <div className="flex flex-wrap gap-3">
            {comprobanteId && (
              <a href={`/comprobantes/${comprobanteId}/pdf`} className={buttonVariants({ variant: "outline", className: "h-10" })}>
                <DownloadIcon /> Descargar comprobante
              </a>
            )}
            <Button type="button" variant="ghost" className="h-10" onClick={() => router.refresh()}>
              Ver mis pagos
            </Button>
          </div>
        ) : vencida ? (
          <p className="text-sm text-muted-foreground">Tu reserva venció. Si aún hay cupos, vuelve a inscribirte desde el catálogo.</p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" onClick={() => void abrir()} disabled={!listo || ocupado} className="h-10 px-5">
                <CreditCardIcon /> {conError ? "Intentar de nuevo" : estado === "checkout" ? "Abrir de nuevo el pago" : "Pagar en línea"}
              </Button>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheckIcon className="size-3.5 text-green-600" /> Tarjeta, Yape, Plin u otras billeteras · procesado por Culqi
              </p>
            </div>
            {pagoManual && (conError || falloScript) && (
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>¿La pasarela no funciona? Paga directo:</span>
                <Button type="button" variant="outline" size="sm" onClick={() => void pasarAPagoDirecto("YAPE")}>
                  <SmartphoneIcon /> Yape
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => void pasarAPagoDirecto("PLIN")}>
                  <SmartphoneIcon /> Plin
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
