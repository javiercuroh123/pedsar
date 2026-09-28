import { NextResponse } from "next/server";
import { esPasarelaValida, getPasarela } from "@/lib/pagos";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Webhook de las pasarelas: POST /api/pagos/webhook/culqi | izipay | niubiz
 * Actualiza el estado del pago y confirma la inscripción cuando se aprueba.
 * Está excluido del proxy (no hay sesión de usuario en estas llamadas).
 */
export async function POST(request: Request, ctx: RouteContext<"/api/pagos/webhook/[proveedor]">) {
  const { proveedor } = await ctx.params;
  if (!esPasarelaValida(proveedor)) return NextResponse.json({ error: "Proveedor desconocido" }, { status: 404 });

  const cuerpo = await request.text();
  const evento = await getPasarela(proveedor).procesarWebhook(cuerpo, request.headers);
  if (!evento) return NextResponse.json({ recibido: true });

  const supabase = createAdminClient();
  const { data: pago, error } = await supabase
    .from("pagos")
    .update({
      estado: evento.estado,
      respuesta_pasarela: evento.respuesta,
      fecha_pago: evento.estado === "APROBADO" ? new Date().toISOString() : null,
    })
    .eq("referencia_pasarela", evento.referencia)
    .select("inscripcion_id")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (pago && evento.estado === "APROBADO") {
    await supabase.from("inscripciones").update({ estado: "CONFIRMADA" }).eq("id", pago.inscripcion_id);
    // TODO: emitir comprobante electrónico (SUNAT) y enviar correoConfirmacionMatricula.
  }

  return NextResponse.json({ recibido: true });
}
