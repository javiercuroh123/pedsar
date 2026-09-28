/** Tipos de dominio compartidos (reflejan los enums de la migración inicial). */

export const ROLES = ["administrador", "instructor", "estudiante"] as const;
export type Rol = (typeof ROLES)[number];

export type EstadoCurso = "BORRADOR" | "PUBLICADO" | "DESPUBLICADO";
export type Modalidad = "PRESENCIAL" | "VIRTUAL" | "SEMIPRESENCIAL";
export type Nivel = "BASICO" | "INTERMEDIO" | "AVANZADO";
export type TipoContenido = "PDF" | "VIDEO" | "ENLACE";
export type EstadoInscripcion = "PENDIENTE" | "CONFIRMADA" | "CANCELADA";
export type MetodoPago = "CULQI" | "IZIPAY" | "NIUBIZ" | "YAPE" | "PLIN";
export type EstadoPago = "PENDIENTE" | "APROBADO" | "RECHAZADO" | "REEMBOLSADO";
export type EstadoAsistencia = "PRESENTE" | "AUSENTE" | "TARDANZA";

export interface Perfil {
  id: string;
  nombres: string;
  apellidos: string;
  correo: string;
  rol: Rol;
  especialidad: string | null;
  avatar_url: string | null;
  estado: boolean;
}
