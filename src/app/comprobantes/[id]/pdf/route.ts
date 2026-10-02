import { generarPdfComprobante } from "@/features/matricula/pdf-comprobante";
import { requireUsuario } from "@/lib/auth";
import { etiquetaPago } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";
import type { MedioPago, MetodoPago } from "@/types/dominio";

/**
 * HU-12 · HU-30 · Descarga del comprobante interno de pago: GET /comprobantes/41/pdf
 * Se genera al vuelo con los datos congelados al aprobarse el pago. RLS decide quién
 * puede descargarlo: el estudiante dueño del pago y el administrador.
 */
export async function GET(_request: Request, ctx: RouteContext<"/comprobantes/[id]/pdf">) {
  await requireUsuario(); // sin sesión → /login
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0) return new Response("Comprobante no encontrado", { status: 404 });

  const supabase = await createClient();
  const { data: c } = await supabase
    .from("comprobantes")
    .select("id, serie, numero, fecha_emision, tipo, cliente_nombre, cliente_documento, ruc, razon_social, concepto, subtotal, descuento, total, metodo, medio, referencia_pasarela")
    .eq("id", id)
    .maybeSingle();
  if (!c) return new Response("Comprobante no encontrado", { status: 404 });

  const pdf = await generarPdfComprobante({
    serie: c.serie,
    numero: c.numero,
    fechaEmision: c.fecha_emision,
    tipoSolicitado: c.tipo,
    cliente: { nombre: c.cliente_nombre ?? "", documento: c.cliente_documento, ruc: c.ruc, razonSocial: c.razon_social },
    concepto: c.concepto ?? "",
    subtotal: Number(c.subtotal ?? c.total ?? 0),
    descuento: Number(c.descuento ?? 0),
    total: Number(c.total ?? 0),
    pago: c.metodo ? etiquetaPago(c.metodo as MetodoPago, c.medio as MedioPago | null) : "—",
    referencia: c.referencia_pasarela,
  });

  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="comprobante-${c.serie}-${c.numero}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
