const soloDigitos = (valor: string) => valor.replace(/\D/g, "");
const telefono = process.env.NEXT_PUBLIC_EMPRESA_TELEFONO?.trim() || "+51 956 000 000";

/**
 * Datos de contacto y cobro directo de la empresa (sección 1 y Tabla 12 del documento).
 * Pueden sobreescribirse mediante variables de entorno NEXT_PUBLIC_EMPRESA_* y
 * NEXT_PUBLIC_PAGO_DIRECTO_* en producción sin modificar el código fuente.
 */
export const EMPRESA = {
  razonSocial: "Consultoría en Sistemas Informáticos – Electrónica y Servicios Múltiples PEDSAR E.I.R.L.",
  ruc: "20605615521",
  direccion: "Jr. Manuel Medina Paredes N.º 524, Bar. José de la Torre Ugarte, Ica – Perú",
  telefono,
  whatsapp: process.env.NEXT_PUBLIC_EMPRESA_WHATSAPP?.trim() || soloDigitos(telefono) || "51956000000",
  correo: process.env.NEXT_PUBLIC_EMPRESA_CORREO?.trim() || "informes@pedsar.pe",
  horario: process.env.NEXT_PUBLIC_EMPRESA_HORARIO?.trim() || "Lunes a viernes de 9:00 a 18:00 · Sábados de 9:00 a 13:00",
  /**
   * Cobro directo por Yape / Plin mientras se activa la pasarela (Tabla 12 del proyecto).
   * Configurable por variables de entorno NEXT_PUBLIC_PAGO_DIRECTO_CELULAR y NEXT_PUBLIC_PAGO_DIRECTO_TITULAR.
   */
  pagoDirecto: {
    celular: process.env.NEXT_PUBLIC_PAGO_DIRECTO_CELULAR?.trim() || "",
    titular: process.env.NEXT_PUBLIC_PAGO_DIRECTO_TITULAR?.trim() || "",
  },
};

/** Versión vigente de la política de privacidad y términos (HU-49 · Ley N.º 29733). */
export const VERSION_POLITICA_PRIVACIDAD = "2026-10";

/** Máximo de sesiones activas simultáneas por usuario (RNF-04). */
export const MAX_SESIONES_CONCURRENTES = 2;
