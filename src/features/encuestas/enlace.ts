import "server-only";
import { publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * HU-43 · Enlace a la encuesta que el trigger de la BD creó al emitirse el
 * certificado de una inscripción; null si no hay encuesta activa.
 */
export async function enlaceEncuestaDe(inscripcionId: string): Promise<string | null> {
  const { data } = await createAdminClient().from("encuesta_envios").select("id").eq("inscripcion_id", inscripcionId).maybeSingle();
  return data ? `${publicEnv.NEXT_PUBLIC_SITE_URL}/estudiante/encuestas/${data.id}` : null;
}
