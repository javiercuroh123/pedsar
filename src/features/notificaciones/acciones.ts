"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { registrarActividad } from "@/lib/auditoria";
import { requireUsuario } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// HU-51 · Notificaciones in-app: marcar como leídas (RLS: solo las propias)
export async function marcarTodasLeidas() {
  const usuario = await requireUsuario();
  const supabase = await createClient();
  await supabase.from("notificaciones").update({ leida: true }).eq("usuario_id", usuario.id).eq("leida", false);
  revalidatePath("/", "layout");
}

export async function marcarLeida(id: number) {
  const usuario = await requireUsuario();
  const supabase = await createClient();
  await supabase.from("notificaciones").update({ leida: true }).eq("id", id).eq("usuario_id", usuario.id);
  revalidatePath("/", "layout");
}

const canalSchema = z.enum(["AMBOS", "CORREO", "IN_APP"], "Elige un canal válido");

/** HU-21 · HU-41 · RF-11 · Preferencia de canal de notificación y recordatorios del usuario. */
export async function actualizarCanalNotificacion(formData: FormData) {
  const usuario = await requireUsuario();
  const d = canalSchema.safeParse(formData.get("canal"));
  if (!d.success) return { ok: false, mensaje: d.error.issues[0]?.message ?? "Canal no válido" };
  const supabase = await createClient();
  const { error } = await supabase.from("perfiles").update({ canal_notificacion: d.data }).eq("id", usuario.id);
  if (error) return { ok: false, mensaje: "No se pudo actualizar la preferencia" };
  await registrarActividad(usuario.id, "ACTUALIZAR_NOTIFICACIONES", { canal: d.data });
  revalidatePath("/cuenta/notificaciones");
  return { ok: true, mensaje: "Preferencia de notificaciones actualizada" };
}
