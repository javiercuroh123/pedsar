import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { confirmarPago } from "@/features/matricula/confirmar-pago";
import { registrarActividad } from "@/lib/auditoria";
import { serverEnv } from "@/lib/env.server";
import { esPasarelaValida, getPasarela, type ConsultaPasarela, type PasarelaPago } from "@/lib/pagos";
import { createAdminClient } from "@/lib/supabase/admin";

const recibido = () => NextResponse.json({ recibido: true });

/** Clave secreta que se configura en la URL del webhook (CulqiPanel → Eventos → Webhooks). */
function claveValida(proveedor: PasarelaPago["nombre"], clave: string | null) {
  const secreto = proveedor === "culqi" ? serverEnv.CULQI_WEBHOOK_SECRET : undefined;
  if (!secreto || !clave) return false;
  const a = Buffer.from(clave);
  const b = Buffer.from(secreto);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Webhook de las pasarelas: POST /api/pagos/webhook/culqi?clave=…
 * No se confía en el contenido del aviso: solo indica qué orden o cargo consultar,
 * y el estado y el monto se preguntan a la API de la pasarela antes de confirmar.
 * Está excluido del proxy (no hay sesión de usuario en estas llamadas).
 */
export async function POST(request: Request, ctx: RouteContext<"/api/pagos/webhook/[proveedor]">) {
  const { proveedor } = await ctx.params;
  if (!esPasarelaValida(proveedor)) return NextResponse.json({ error: "Proveedor desconocido" }, { status: 404 });
  if (!claveValida(proveedor, new URL(request.url).searchParams.get("clave"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const pasarela = getPasarela(proveedor);
  const aviso = pasarela.leerWebhook(await request.text());
  if (!aviso) return recibido();

  let consulta: ConsultaPasarela;
  try {
    consulta = await pasarela.consultar(aviso);
  } catch (e) {
    // 500: la pasarela vuelve a enviar el aviso más tarde.
    console.error(`Webhook ${proveedor}: no se pudo consultar ${aviso.tipo} ${aviso.id}:`, (e as Error).message);
    return NextResponse.json({ error: "No se pudo verificar el pago con la pasarela" }, { status: 500 });
  }
  if (consulta.estado !== "PAGADO") return recibido();

  const db = createAdminClient();
  const porId = z.uuid().safeParse(consulta.pagoId);
  const { data: pago } = await db
    .from("pagos")
    .select("id, monto")
    .eq(porId.success ? "id" : aviso.tipo === "orden" ? "orden_pasarela" : "referencia_pasarela", porId.success ? porId.data : aviso.id)
    .maybeSingle();
  if (!pago) {
    console.error(`Webhook ${proveedor}: ${aviso.tipo} ${aviso.id} pagado sin pago asociado en PEDSAR`);
    return recibido();
  }

  const esperado = Math.round(Number(pago.monto) * 100);
  if (esperado !== consulta.montoCentimos) {
    await registrarActividad(null, "PAGO_MONTO_DISTINTO", { pago: pago.id, referencia: consulta.referencia, esperado, recibido: consulta.montoCentimos });
    return recibido();
  }

  try {
    await confirmarPago(pago.id, { referencia: consulta.referencia, medio: consulta.medio, respuesta: consulta.respuesta, actor: null });
  } catch (e) {
    // 500: la pasarela reintenta el aviso y confirmarPago completa lo que faltó.
    console.error(`Webhook ${proveedor}: no se pudo confirmar el pago ${pago.id}:`, (e as Error).message);
    return NextResponse.json({ error: "No se pudo confirmar el pago" }, { status: 500 });
  }
  return recibido();
}
