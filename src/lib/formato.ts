import type { EstadoCurso, EstadoInscripcion, EstadoPago, MetodoPago, Modalidad, Nivel } from "@/types/dominio";

// Todas las fechas se muestran en hora de Perú, aunque el servidor corra en UTC.
const ZONA = "America/Lima";
const soles = new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" });
const fecha = new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeZone: ZONA });
const fechaCorta = new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short", timeZone: ZONA });
const fechaHora = new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short", timeZone: ZONA });
const diaSemana = new Intl.DateTimeFormat("es-PE", { weekday: "short", timeZone: ZONA });

/** Las columnas `date` (AAAA-MM-DD) se leen a mediodía para no cambiar de día por la zona horaria. */
const aFecha = (valor: string | Date) =>
  typeof valor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valor) ? new Date(`${valor}T12:00:00-05:00`) : new Date(valor);

export const formatearSoles = (monto: number) => soles.format(monto);
export const formatearFecha = (valor: string | Date) => fecha.format(aFecha(valor));
export const formatearFechaCorta = (valor: string | Date) => fechaCorta.format(aFecha(valor)).replace(".", "");
export const formatearFechaHora = (valor: string | Date) => fechaHora.format(aFecha(valor));
export const formatearDiaSemana = (valor: string | Date) => diaSemana.format(aFecha(valor)).replace(".", "");
export const formatearHora = (hora: string) => hora.slice(0, 5);

/** Fecha de hoy en Perú, en formato AAAA-MM-DD (para comparar con columnas `date`). */
export const hoyISO = () => new Intl.DateTimeFormat("en-CA", { timeZone: ZONA }).format(new Date());

/** Suma minutos a una hora "HH:MM[:SS]" y devuelve "HH:MM". */
export function horaFin(inicio: string, minutos: number) {
  const [h, m] = inicio.split(":").map(Number);
  const total = h * 60 + m + minutos;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export const iniciales = (nombre: string) =>
  nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("") || "?";

export const nombreCompleto = (p: { nombres?: string | null; apellidos?: string | null } | null | undefined) =>
  [p?.nombres, p?.apellidos].filter(Boolean).join(" ").trim();

export const ETIQUETA_MODALIDAD: Record<Modalidad, string> = {
  PRESENCIAL: "Presencial",
  VIRTUAL: "Virtual",
  SEMIPRESENCIAL: "Semipresencial",
};

export const ETIQUETA_NIVEL: Record<Nivel, string> = {
  BASICO: "Básico",
  INTERMEDIO: "Intermedio",
  AVANZADO: "Avanzado",
};

export const ETIQUETA_METODO: Record<MetodoPago, string> = {
  CULQI: "Tarjeta (Culqi)",
  IZIPAY: "Tarjeta (Izipay)",
  NIUBIZ: "Tarjeta (Niubiz)",
  YAPE: "Yape",
  PLIN: "Plin",
};

/** Situación de un pago directo (Yape / Plin) pendiente, vista por el estudiante. */
export function situacionPagoPendiente(pago: { reportado_en: string | null; observacion: string | null }) {
  if (pago.reportado_en) return { texto: "pago en validación", accion: "Ver pago" };
  if (pago.observacion) return { texto: "revisa la observación de tu pago", accion: "Corregir pago" };
  return { texto: "falta registrar tu pago", accion: "Registrar pago" };
}

export const ETIQUETA_ESTADO: Record<EstadoCurso | EstadoInscripcion | EstadoPago | string, string> = {
  PUBLICADO: "Publicado",
  BORRADOR: "Borrador",
  DESPUBLICADO: "Despublicado",
  PENDIENTE: "Pendiente",
  CONFIRMADA: "Confirmada",
  CANCELADA: "Cancelada",
  APROBADO: "Aprobado",
  RECHAZADO: "Rechazado",
  REEMBOLSADO: "Reembolsado",
  SOLICITADO: "Solicitado",
  PROCESADO: "Procesado",
};
