import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface Notificacion {
  id: number;
  mensaje: string;
  tipo: "CORREO" | "IN_APP";
  enlace: string | null;
  leida: boolean;
  fecha_envio: string;
}

export async function listarNotificaciones(usuarioId: string, limite?: number) {
  const supabase = await createClient();
  let consulta = supabase
    .from("notificaciones")
    .select("id, mensaje, tipo, enlace, leida, fecha_envio")
    .eq("usuario_id", usuarioId)
    .order("fecha_envio", { ascending: false });
  if (limite) consulta = consulta.limit(limite);
  const { data } = await consulta;
  return (data ?? []) as Notificacion[];
}

export async function contarNoLeidas(usuarioId: string) {
  const supabase = await createClient();
  const { count } = await supabase
    .from("notificaciones")
    .select("id", { head: true, count: "exact" })
    .eq("usuario_id", usuarioId)
    .eq("leida", false);
  return count ?? 0;
}
