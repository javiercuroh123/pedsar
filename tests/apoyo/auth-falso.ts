import { vi } from "vitest";
import { INICIO_POR_ROL } from "@/config/navegacion";
import type { Rol } from "@/types/dominio";
import { entorno, Redireccion } from "./entorno";

/**
 * Reemplazo de @/lib/auth para probar acciones: el usuario con sesión es
 * `entorno.usuario` y se respetan las mismas redirecciones que el original.
 * Uso: vi.mock("@/lib/auth", () => import("../apoyo/auth-falso"));
 */
export const getUsuarioActual = vi.fn(async () => entorno.usuario);

export const requireUsuario = vi.fn(async () => {
  if (!entorno.usuario) throw new Redireccion("/login");
  return entorno.usuario;
});

export const requireRol = vi.fn(async (...roles: Rol[]) => {
  const usuario = await requireUsuario();
  if (!roles.includes(usuario.rol)) throw new Redireccion(INICIO_POR_ROL[usuario.rol]);
  return usuario;
});
