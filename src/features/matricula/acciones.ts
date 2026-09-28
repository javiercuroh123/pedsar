"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { registrarActividad } from "@/lib/auditoria";
import { requireRol } from "@/lib/auth";
import { hoyISO } from "@/lib/formato";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const inscripcionSchema = z.object({
  cursoId: z.uuid(),
  metodo: z.enum(["CULQI", "IZIPAY", "NIUBIZ", "YAPE", "PLIN"]),
  cupon: z.string().trim().toUpperCase().optional(),
  telefono: z.string().trim().max(20).optional(),
  documento: z.string().trim().max(12).optional(),
  comprobante: z.enum(["BOLETA", "FACTURA"]).default("BOLETA"),
  ruc: z.string().trim().max(11).optional(),
  razonSocial: z.string().trim().max(160).optional(),
});

export interface ResultadoCupon {
  ok: boolean;
  mensaje: string;
  porcentaje?: number;
}

/** Busca un cupón vigente. Los cupones no son legibles por estudiantes (RLS), por eso usa el cliente admin. */
async function buscarCupon(codigo: string) {
  const admin = createAdminClient();
  const { data: cupon } = await admin
    .from("cupones")
    .select("id, porcentaje_descuento, fecha_vigencia, usos_maximos, activo")
    .eq("codigo", codigo.trim().toUpperCase())
    .maybeSingle();
  if (!cupon || !cupon.activo || cupon.fecha_vigencia < hoyISO()) return null;
  if (cupon.usos_maximos) {
    const { count } = await admin.from("pagos").select("id", { head: true, count: "exact" }).eq("cupon_id", cupon.id);
    if ((count ?? 0) >= cupon.usos_maximos) return null;
  }
  return { id: cupon.id as number, porcentaje: Number(cupon.porcentaje_descuento) };
}

// HU-32 · Cupones de descuento
export async function validarCupon(codigo: string): Promise<ResultadoCupon> {
  await requireRol("estudiante");
  if (!codigo.trim()) return { ok: false, mensaje: "Ingresa un cupón" };
  const cupon = await buscarCupon(codigo);
  return cupon
    ? { ok: true, mensaje: `Cupón aplicado: ${cupon.porcentaje} % de descuento`, porcentaje: cupon.porcentaje }
    : { ok: false, mensaje: "Cupón no válido o vencido" };
}

/**
 * HU-07 · Inscripción a cursos · HU-12 · Pagos en línea.
 * Crea la inscripción PENDIENTE (el trigger de BD valida el cupo, HU-17) y su
 * pago PENDIENTE con el monto final. La pasarela confirma el pago por webhook
 * → /api/pagos/webhook/[proveedor] → CONFIRMADA; el administrador también
 * puede validarlo manualmente desde Inscripciones y pagos.
 */
export async function inscribirse(formData: FormData) {
  const estudiante = await requireRol("estudiante");
  const datos = inscripcionSchema.parse(Object.fromEntries(formData));
  const supabase = await createClient();

  const { data: curso } = await supabase.from("cursos").select("id, precio, slug").eq("id", datos.cursoId).single();
  if (!curso) redirect("/cursos");

  if (datos.telefono || datos.documento) {
    await supabase
      .from("perfiles")
      .update({ telefono: datos.telefono || null, documento: datos.documento || null })
      .eq("id", estudiante.id);
  }

  const { data: inscripcion, error } = await supabase
    .from("inscripciones")
    .insert({ estudiante_id: estudiante.id, curso_id: datos.cursoId })
    .select("id, codigo")
    .single();

  if (error) {
    const mensaje =
      error.code === "23505" ? "Ya estás inscrito en este curso" : error.code === "P0001" ? "El curso ya no tiene cupos disponibles" : error.message;
    redirect(`/estudiante/cursos?error=${encodeURIComponent(mensaje)}`);
  }

  const cupon = datos.cupon ? await buscarCupon(datos.cupon) : null;
  const monto = Math.round(Number(curso.precio) * (1 - (cupon?.porcentaje ?? 0) / 100) * 100) / 100;

  // Los pagos solo los escribe el servidor (sin política de inserción para estudiantes).
  await createAdminClient()
    .from("pagos")
    .insert({ inscripcion_id: inscripcion.id, cupon_id: cupon?.id ?? null, monto, metodo: datos.metodo });

  await registrarActividad(estudiante.id, "INSCRIPCION_CREADA", {
    inscripcion: inscripcion.id,
    metodo: datos.metodo,
    monto,
    cupon: cupon ? datos.cupon : null,
    comprobante: datos.comprobante,
    ...(datos.comprobante === "FACTURA" ? { ruc: datos.ruc, razon_social: datos.razonSocial } : {}),
  });

  // TODO: cobrar con getPasarela().cobrar(...) usando el token del checkout de la pasarela
  // y emitir el comprobante electrónico (SUNAT) cuando el pago se apruebe.
  revalidatePath("/estudiante", "layout");
  redirect(`/estudiante/pagos?inscripcion=${inscripcion.codigo}`);
}
