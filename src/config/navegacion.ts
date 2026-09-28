import type { Rol } from "@/types/dominio";

/** Nombre del ícono de lucide que se muestra junto al enlace (se resuelve en PanelNav). */
export type IconoNav =
  | "inicio"
  | "cursos"
  | "evaluaciones"
  | "pagos"
  | "certificados"
  | "contenidos"
  | "sesiones"
  | "asistencia"
  | "notas"
  | "usuarios"
  | "categorias"
  | "inscripciones"
  | "cupones"
  | "reportes"
  | "auditoria"
  | "perfil"
  | "notificaciones";

export interface ItemNav {
  titulo: string;
  href: string;
  icono: IconoNav;
}

export interface GrupoNav {
  titulo: string;
  items: ItemNav[];
}

/** Panel principal de cada rol (a dónde se redirige después del login). */
export const INICIO_POR_ROL: Record<Rol, string> = {
  administrador: "/admin",
  instructor: "/instructor",
  estudiante: "/estudiante",
};

const CUENTA: GrupoNav = {
  titulo: "Cuenta",
  items: [
    { titulo: "Notificaciones", href: "/cuenta/notificaciones", icono: "notificaciones" },
    { titulo: "Mi perfil", href: "/cuenta/perfil", icono: "perfil" },
  ],
};

/** Menú lateral de cada portal, agrupado por secciones (mismo orden que el prototipo). */
export const NAV_POR_ROL: Record<Rol, GrupoNav[]> = {
  estudiante: [
    {
      titulo: "Aprendizaje",
      items: [
        { titulo: "Inicio", href: "/estudiante", icono: "inicio" },
        { titulo: "Mis cursos", href: "/estudiante/cursos", icono: "cursos" },
        { titulo: "Evaluaciones", href: "/estudiante/evaluaciones", icono: "evaluaciones" },
        { titulo: "Certificados", href: "/estudiante/certificados", icono: "certificados" },
        { titulo: "Pagos y comprobantes", href: "/estudiante/pagos", icono: "pagos" },
      ],
    },
    CUENTA,
  ],
  instructor: [
    {
      titulo: "Docencia",
      items: [
        { titulo: "Inicio", href: "/instructor", icono: "inicio" },
        { titulo: "Contenidos", href: "/instructor/contenidos", icono: "contenidos" },
        { titulo: "Sesiones y horarios", href: "/instructor/sesiones", icono: "sesiones" },
        { titulo: "Asistencia", href: "/instructor/asistencia", icono: "asistencia" },
        { titulo: "Evaluaciones", href: "/instructor/evaluaciones", icono: "evaluaciones" },
        { titulo: "Estudiantes y notas", href: "/instructor/notas", icono: "notas" },
      ],
    },
    CUENTA,
  ],
  administrador: [
    {
      titulo: "General",
      items: [
        { titulo: "Panel", href: "/admin", icono: "inicio" },
        { titulo: "Reportes", href: "/admin/reportes", icono: "reportes" },
      ],
    },
    {
      titulo: "Académico",
      items: [
        { titulo: "Cursos", href: "/admin/cursos", icono: "cursos" },
        { titulo: "Categorías", href: "/admin/categorias", icono: "categorias" },
        { titulo: "Certificados", href: "/admin/certificados", icono: "certificados" },
      ],
    },
    {
      titulo: "Comercial",
      items: [
        { titulo: "Inscripciones y pagos", href: "/admin/inscripciones", icono: "inscripciones" },
        { titulo: "Cupones", href: "/admin/cupones", icono: "cupones" },
      ],
    },
    {
      titulo: "Sistema",
      items: [
        { titulo: "Usuarios y roles", href: "/admin/usuarios", icono: "usuarios" },
        { titulo: "Auditoría", href: "/admin/auditoria", icono: "auditoria" },
      ],
    },
    CUENTA,
  ],
};

/** Prefijos de ruta que requieren sesión, y el rol que exige cada uno. */
export const RUTAS_PROTEGIDAS: { prefijo: string; roles: Rol[] | "cualquiera" }[] = [
  { prefijo: "/admin", roles: ["administrador"] },
  { prefijo: "/instructor", roles: ["instructor", "administrador"] },
  { prefijo: "/estudiante", roles: ["estudiante"] },
  { prefijo: "/cuenta", roles: "cualquiera" },
];
