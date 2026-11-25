import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { enviarRecordatoriosPendientes } from "@/features/notificaciones/enviar";
import { serverEnv } from "@/lib/env.server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Compara el encabezado `Authorization: Bearer …` con CRON_SECRET en tiempo constante. */
function autorizado(request: Request) {
  const secreto = serverEnv.CRON_SECRET;
  const encabezado = request.headers.get("authorization");
  if (!secreto || !encabezado) return false;
  const a = Buffer.from(encabezado);
  const b = Buffer.from(`Bearer ${secreto}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * HU-21 · HU-40 · RF-11 · GET /api/cron/recordatorios
 * La llama cada 15 minutos privado.disparar_recordatorios_correo() (pg_cron + pg_net)
 * con `Authorization: Bearer <CRON_SECRET>`. Es el mismo formato que usa Vercel Cron,
 * así que también se puede programar desde vercel.json en el plan Pro.
 * Está excluida del proxy: no hay sesión de usuario en estas llamadas.
 */
export async function GET(request: Request) {
  if (!autorizado(request)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  try {
    const enviados = await enviarRecordatoriosPendientes();
    return NextResponse.json({ ok: true, ...enviados });
  } catch (e) {
    console.error("Recordatorios por correo:", (e as Error).message);
    return NextResponse.json({ error: "No se pudieron procesar los recordatorios" }, { status: 500 });
  }
}
