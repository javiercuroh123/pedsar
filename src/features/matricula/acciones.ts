"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { EMPRESA } from "@/config/empresa";
import { PLAZO_PAGO_HORAS, reservaVencida } from "@/config/matricula";
import { uno } from "@/features/academico/consultas";
import { confirmarPago } from "@/features/matricula/confirmar-pago";
import { notificarAdministradores } from "@/features/notificaciones/enviar";
import type { EstadoFormulario } from "@/features/usuarios/esquemas";
import { registrarActividad } from "@/lib/auditoria";
import { requireRol } from "@/lib/auth";
import { programarCorreo } from "@/lib/email";
import { correoInscripcionPorPagar, correoInscripcionRegistrada } from "@/lib/email/plantillas";
import { publicEnv } from "@/lib/env";
import { pagoManualHabilitado, pasarelaActiva } from "@/lib/pagos";
import { ETIQUETA_METODO, formatearFechaHora, formatearSoles, hoyISO } from "@/lib/formato";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const inscripcionSchema = z.object({
  cursoId: z.uuid(),
  // CULQI: pago en línea (tarjeta, Yape, billeteras); YAPE / PLIN: pago directo validado por el administrador.
  metodo: z.enum(["CULQI", "YAPE", "PLIN"], "Elige cómo pagar"),
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
 * pago PENDIENTE con el monto final. El pago en línea se hace después, en
 * «Pagos» (pago-en-linea.ts); el directo por Yape / Plin lo valida el administrador.
 */
export async function inscribirse(formData: FormData) {
  const estudiante = await requireRol("estudiante");
  const datos = inscripcionSchema.parse(Object.fromEntries(formData));
  const enLinea = datos.metodo === "CULQI";
  const noDisponible = enLinea
    ? !pasarelaActiva() && "El pago en línea aún no está disponible"
    : !pagoManualHabilitado() && "El pago directo por Yape o Plin no está disponible";
  if (noDisponible) redirect(`/estudiante/cursos?error=${encodeURIComponent(noDisponible)}`);
  const supabase = await createClient();

  const { data: curso } = await supabase.from("cursos").select("id, titulo, precio, slug").eq("id", datos.cursoId).single();
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
    .select("id, codigo, vence_en")
    .single();

  if (error) {
    const mensaje =
      error.code === "23505" ? "Ya estás inscrito en este curso" : error.code === "P0001" ? "El curso ya no tiene cupos disponibles" : error.message;
    redirect(`/estudiante/cursos?error=${encodeURIComponent(mensaje)}`);
  }

  const cupon = datos.cupon ? await buscarCupon(datos.cupon) : null;
  const monto = Math.round(Number(curso.precio) * (1 - (cupon?.porcentaje ?? 0) / 100) * 100) / 100;

  // Los pagos solo los escribe el servidor (sin política de inserción para estudiantes).
  const datosFacturacion =
    datos.comprobante === "FACTURA" ? { tipo: "FACTURA", ruc: datos.ruc ?? null, razon_social: datos.razonSocial ?? null } : { tipo: "BOLETA" };
  const { data: pago } = await createAdminClient()
    .from("pagos")
    .insert({ inscripcion_id: inscripcion.id, cupon_id: cupon?.id ?? null, monto, metodo: datos.metodo, datos_facturacion: datosFacturacion })
    .select("id")
    .single();

  await registrarActividad(estudiante.id, "INSCRIPCION_CREADA", {
    inscripcion: inscripcion.id,
    metodo: datos.metodo,
    monto,
    cupon: cupon ? datos.cupon : null,
    comprobante: datos.comprobante,
    ...(datos.comprobante === "FACTURA" ? { ruc: datos.ruc, razon_social: datos.razonSocial } : {}),
  });

  // Cupón del 100 % (beca): no hay nada que cobrar, se confirma de inmediato.
  if (monto <= 0 && pago) {
    await confirmarPago(pago.id, { actor: estudiante.id });
    redirect("/estudiante/cursos");
  }

  // HU-21 · Confirmación de la inscripción con el plazo de la reserva y cómo pagar.
  const comun = {
    nombre: estudiante.nombres || "estudiante",
    curso: curso.titulo,
    codigo: inscripcion.codigo,
    monto: formatearSoles(monto),
    venceEn: inscripcion.vence_en ? formatearFechaHora(inscripcion.vence_en) : `${PLAZO_PAGO_HORAS} horas`,
    url: `${publicEnv.NEXT_PUBLIC_SITE_URL}/estudiante/pagos${enLinea ? `?pagar=${inscripcion.codigo}` : ""}`,
  };
  programarCorreo({
    para: estudiante.correo,
    ...(enLinea
      ? correoInscripcionPorPagar(comun)
      : correoInscripcionRegistrada({
          ...comun,
          app: datos.metodo === "YAPE" ? "Yape" : "Plin",
          celular: EMPRESA.pagoDirecto.celular,
          titular: EMPRESA.pagoDirecto.titular,
        })),
  });

  revalidatePath("/estudiante", "layout");
  redirect(enLinea ? `/estudiante/pagos?pagar=${inscripcion.codigo}` : `/estudiante/pagos?inscripcion=${inscripcion.codigo}`);
}

const pagoManualSchema = z.object({
  pagoId: z.uuid(),
  // Se quitan los espacios: en la constancia el número suele mostrarse agrupado.
  numeroOperacion: z.preprocess(
    (v) => (typeof v === "string" ? v.replace(/\s+/g, "").toUpperCase() : v),
    z.string().regex(/^[A-Z0-9-]{4,30}$/, "Escribe el N.º de operación tal como aparece en tu app (solo letras y números)"),
  ),
  voucher: z.preprocess((v) => (v === "" ? undefined : v), z.string().max(200).optional()),
});

/**
 * CU «Registrar pago manual» · el estudiante informa el N.º de operación de Yape / Plin
 * y, si quiere, la captura, que el navegador sube antes al bucket privado "vouchers".
 * El administrador lo valida en Inscripciones y pagos (CU «Validar comprobantes»).
 */
export async function registrarPagoManual(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const estudiante = await requireRol("estudiante");
  const d = pagoManualSchema.safeParse(Object.fromEntries(formData));
  if (!d.success) return { ok: false, mensaje: d.error.issues[0]?.message ?? "Datos no válidos" };
  const { pagoId, numeroOperacion, voucher } = d.data;
  // La captura debe estar en la carpeta del propio estudiante, con el nombre que genera el formulario.
  if (voucher && !new RegExp(`^${estudiante.id}/[\\w-]+\\.(jpg|png|webp|pdf)$`).test(voucher)) {
    return { ok: false, mensaje: "La captura no es válida; vuelve a adjuntarla" };
  }

  // Se lee con la sesión del estudiante: RLS garantiza que el pago es suyo.
  const supabase = await createClient();
  const { data: pago } = await supabase
    .from("pagos")
    .select("id, metodo, estado, inscripcion:inscripciones(id, codigo, estado, vence_en, curso:cursos(titulo))")
    .eq("id", pagoId)
    .maybeSingle();
  const inscripcion = uno<{ id: string; codigo: string; estado: string; vence_en: string | null; curso: unknown }>(pago?.inscripcion);
  if (!pago || !inscripcion) return { ok: false, mensaje: "No encontramos ese pago" };
  if (reservaVencida(inscripcion)) {
    return { ok: false, mensaje: "Tu reserva venció. Vuelve a inscribirte y registra el pago en la nueva inscripción." };
  }
  if (pago.estado !== "PENDIENTE" || inscripcion.estado !== "PENDIENTE") return { ok: false, mensaje: "Este pago ya fue validado" };
  if (pago.metodo !== "YAPE" && pago.metodo !== "PLIN") return { ok: false, mensaje: "Este pago se procesa por la pasarela" };

  // Pagos e inscripciones solo los escribe el servidor (sin políticas de actualización para estudiantes).
  const db = createAdminClient();
  const { error } = await db
    .from("pagos")
    .update({
      numero_operacion: numeroOperacion,
      reportado_en: new Date().toISOString(),
      observacion: null,
      ...(voucher ? { voucher_ruta: voucher } : {}),
    })
    .eq("id", pago.id);
  if (error) {
    return { ok: false, mensaje: error.code === "23505" ? "Ese N.º de operación ya fue registrado en otro pago" : error.message };
  }
  // Con el pago en validación, la reserva deja de vencer.
  await db.from("inscripciones").update({ vence_en: null }).eq("id", inscripcion.id);

  const curso = uno<{ titulo: string }>(inscripcion.curso)?.titulo ?? "un curso";
  await notificarAdministradores(
    `Pago por validar · ${curso} · ${ETIQUETA_METODO[pago.metodo]} op. ${numeroOperacion}`,
    "/admin/inscripciones?estado=PENDIENTE",
  );
  await registrarActividad(estudiante.id, "REPORTAR_PAGO", { inscripcion: inscripcion.codigo, metodo: pago.metodo, numero_operacion: numeroOperacion });
  revalidatePath("/estudiante", "layout");
  revalidatePath("/admin/inscripciones");
  return { ok: true, mensaje: "¡Listo! Validaremos tu pago y te avisaremos." };
}
