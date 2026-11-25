import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Todo excepto archivos estáticos, imágenes, webhooks de pago y tareas programadas.
    "/((?!_next/static|_next/image|favicon.ico|api/pagos/webhook|api/cron|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
