"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { registrarActividad } from "@/lib/auditoria";
import { requireUsuario } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { EstadoFormulario } from "./esquemas";

const perfilSchema = z.object({
  nombres: z.string().trim().min(2, "Ingresa tus nombres").max(80),
  apellidos: z.string().trim().min(2, "Ingresa tus apellidos").max(80),
  telefono: z.string().trim().max(20).optional(),
  documento: z
    .string()
    .trim()
    .regex(/^(\d{8}|[A-Z0-9]{9,12})?$/i, "DNI de 8 dígitos o CE válido")
    .optional(),
  especialidad: z.string().trim().max(120).optional(),
  avatarUrl: z.union([z.url(), z.literal("")]).optional(),
});

// HU-15 · Edición de perfil
export async function actualizarPerfil(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const usuario = await requireUsuario();
  const d = perfilSchema.safeParse(Object.fromEntries(formData));
  if (!d.success) return { ok: false, mensaje: d.error.issues[0]?.message };
  const supabase = await createClient();
  const { error } = await supabase
    .from("perfiles")
    .update({
      nombres: d.data.nombres,
      apellidos: d.data.apellidos,
      telefono: d.data.telefono || null,
      documento: d.data.documento || null,
      ...(usuario.rol !== "estudiante" && { especialidad: d.data.especialidad || null }),
      ...(d.data.avatarUrl !== undefined && { avatar_url: d.data.avatarUrl || null }),
    })
    .eq("id", usuario.id);
  if (error) return { ok: false, mensaje: "No se pudo guardar el perfil" };
  await registrarActividad(usuario.id, "ACTUALIZAR_PERFIL");
  revalidatePath("/", "layout");
  return { ok: true, mensaje: "Perfil actualizado" };
}
