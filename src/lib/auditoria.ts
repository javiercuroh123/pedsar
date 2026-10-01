import "server-only";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

/**
 * Registra una acción crítica en registro_actividad (HU-61, RNF-05).
 * Nunca interrumpe la acción del usuario: si falla, solo se informa en consola.
 */
export async function registrarActividad(
  usuarioId: string | null,
  accion: string,
  detalle?: Record<string, Json | undefined>,
) {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  try {
    const { error } = await createAdminClient()
      .from("registro_actividad")
      .insert({ usuario_id: usuarioId, accion, detalle: detalle ?? null, direccion_ip: ip });
    if (error) console.error("No se pudo registrar la actividad:", error.message);
  } catch (e) {
    console.error("No se pudo registrar la actividad:", (e as Error).message);
  }
}
