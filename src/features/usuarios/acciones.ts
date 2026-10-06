"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { INICIO_POR_ROL } from "@/config/navegacion";
import { publicEnv } from "@/lib/env";
import { registrarActividad } from "@/lib/auditoria";
import { createClient } from "@/lib/supabase/server";
import type { Rol } from "@/types/dominio";
import {
  loginSchema,
  nuevaContrasenaSchema,
  recuperarSchema,
  registroSchema,
  type EstadoFormulario,
} from "./esquemas";

const errores = (e: z.ZodError) => z.flattenError(e).fieldErrors as EstadoFormulario["errores"];

/** Solo se permiten redirecciones internas después del login. */
const destinoSeguro = (next: FormDataEntryValue | null) =>
  typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : null;

// HU-02 · Inicio de sesión
export async function iniciarSesion(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const datos = loginSchema.safeParse(Object.fromEntries(formData));
  if (!datos.success) return { errores: errores(datos.error) };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: datos.data.correo,
    password: datos.data.contrasena,
  });
  // Supabase solo responde email_not_confirmed si la contraseña es correcta: no revela qué correos existen.
  if (error?.code === "email_not_confirmed")
    return { mensaje: "Aún no confirmas tu correo. Abre el enlace que te enviamos para activar tu cuenta." };
  if (error) return { mensaje: "Correo o contraseña incorrectos" };

  const { data: perfil } = await supabase.from("perfiles").select("rol").eq("id", data.user.id).single();
  await registrarActividad(data.user.id, "INICIO_SESION");

  redirect(destinoSeguro(formData.get("next")) ?? INICIO_POR_ROL[(perfil?.rol as Rol) ?? "estudiante"]);
}

// HU-01 · Registro de usuarios (+ HU-46 verificación por correo)
export async function registrarse(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const datos = registroSchema.safeParse(Object.fromEntries(formData));
  if (!datos.success) return { errores: errores(datos.error) };

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: datos.data.correo,
    password: datos.data.contrasena,
    options: {
      data: { nombres: datos.data.nombres, apellidos: datos.data.apellidos },
      emailRedirectTo: `${publicEnv.NEXT_PUBLIC_SITE_URL}/auth/confirm`,
    },
  });
  if (error) return { mensaje: error.message };

  return { ok: true, mensaje: "Te enviamos un correo para verificar tu cuenta." };
}

// HU-13 · Restablecimiento de contraseña
export async function solicitarRecuperacion(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const datos = recuperarSchema.safeParse(Object.fromEntries(formData));
  if (!datos.success) return { errores: errores(datos.error) };

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(datos.data.correo, {
    redirectTo: `${publicEnv.NEXT_PUBLIC_SITE_URL}/auth/confirm?next=/cuenta/nueva-contrasena`,
  });
  // Mismo mensaje exista o no la cuenta (no revelar correos registrados).
  return { ok: true, mensaje: "Si el correo está registrado, recibirás un enlace para restablecer tu contraseña." };
}

export async function actualizarContrasena(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const datos = nuevaContrasenaSchema.safeParse(Object.fromEntries(formData));
  if (!datos.success) return { errores: errores(datos.error) };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: datos.data.contrasena });
  if (error) return { mensaje: error.message };
  return { ok: true, mensaje: "Contraseña actualizada." };
}

// HU-14 · Cierre de sesión
export async function cerrarSesion() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
