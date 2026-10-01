import { NextResponse } from "next/server";
import { uno } from "@/features/academico/consultas";
import { programarCorreo } from "@/lib/email";
import { correoConfirmacionMatricula } from "@/lib/email/plantillas";
import { publicEnv } from "@/lib/env";
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
    const { data: ins } = await supabase
      .from("inscripciones")
      .update({ estado: "CONFIRMADA", vence_en: null })
      .eq("id", pago.inscripcion_id)
      .select("codigo, estudiante:perfiles(nombres, correo), curso:cursos(titulo)")
      .single();
    // Secuencia, pasos 20-21: correo de confirmación al estudiante.
    const estudiante = uno<{ nombres: string; correo: string }>(ins?.estudiante);
    const curso = uno<{ titulo: string }>(ins?.curso);
    if (ins && estudiante?.correo && curso) {
      programarCorreo({
        para: estudiante.correo,
        ...correoConfirmacionMatricula({
          nombre: estudiante.nombres || "estudiante",
          curso: curso.titulo,
          codigo: ins.codigo,
          url: `${publicEnv.NEXT_PUBLIC_SITE_URL}/estudiante/cursos`,
        }),
      });
    }
    // TODO: emitir comprobante electrónico (SUNAT).
  } else if (pago && evento.estado === "RECHAZADO") {
    // Secuencia, pasos 23-25: el pago rechazado anula la inscripción pendiente y libera el cupo.
    await supabase.from("inscripciones").update({ estado: "CANCELADA" }).eq("id", pago.inscripcion_id).eq("estado", "PENDIENTE");
  } else if (pago && evento.estado === "REEMBOLSADO") {
    await supabase.from("inscripciones").update({ estado: "CANCELADA" }).eq("id", pago.inscripcion_id);
  }

  return NextResponse.json({ recibido: true });
}
