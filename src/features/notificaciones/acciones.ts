"use server";

import { revalidatePath } from "next/cache";
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
