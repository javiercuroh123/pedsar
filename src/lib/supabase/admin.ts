import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";
import type { Database } from "@/types/database";

/**
 * Cliente con la clave secreta: IGNORA RLS.
 * Úsalo solo en el servidor para tareas del sistema (webhooks de pago,
 * emisión de certificados, auditoría). Nunca con datos sin validar.
 */
export function createAdminClient() {
  if (!serverEnv.SUPABASE_SECRET_KEY) {
    throw new Error(
      "Falta SUPABASE_SECRET_KEY en .env.local (Supabase → Project Settings → API Keys → Secret key).",
    );
  }
  return createSupabaseClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SECRET_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
