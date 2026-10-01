"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { registrarActividad } from "@/lib/auditoria";
import { requireRol } from "@/lib/auth";
import { generarCodigoCertificado } from "@/lib/certificados";
import { programarCorreo } from "@/lib/email";
import { correoCertificadoEmitido, correoConfirmacionMatricula, correoPagoObservado, correoPagoRechazado } from "@/lib/email/plantillas";
import { formatearFechaHora, nombreCompleto } from "@/lib/formato";
import { evaluarAptitud } from "@/config/academico";
import { PLAZO_PAGO_HORAS } from "@/config/matricula";
import { obtenerResultados } from "@/features/certificacion/consultas";
import { publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { uno } from "@/features/academico/consultas";
import { notificarUsuario as notificar } from "@/features/notificaciones/enviar";
import type { EstadoFormulario } from "@/features/usuarios/esquemas";

/**
 * Acciones del administrador. La mayoría usan el cliente con sesión (RLS: es_admin);
 * pagos, notificaciones e invitaciones requieren el cliente admin (sin políticas de escritura).
 */
const admin = () => requireRol("administrador");
const fallo = (e: z.ZodError): EstadoFormulario => ({ ok: false, mensaje: e.issues[0]?.message ?? "Datos no válidos" });
const vacioANull = (v: unknown) => (v === "" ? null : v);

const slugDe = (texto: string) =>
  texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

async function slugUnico(base: string, excluirId?: string) {
  const supabase = await createClient();
  let slug = slugDe(base) || "curso";
  for (let i = 2; ; i++) {
    let q = supabase.from("cursos").select("id").eq("slug", slug);
    if (excluirId) q = q.neq("id", excluirId);
    const { data } = await q.maybeSingle();
    if (!data) return slug;
    slug = `${slugDe(base)}-${i}`;
  }
}

// ---------- Cursos (HU-04 · HU-56 · HU-57) ----------
const cursoSchema = z.object({
  id: z.preprocess(vacioANull, z.uuid().nullable()),
  titulo: z.string().trim().min(3, "Escribe el título").max(160),
  descripcion: z.string().trim().max(2000).optional(),
  categoriaId: z.preprocess(vacioANull, z.coerce.number().int().nullable()),
  instructorId: z.preprocess(vacioANull, z.uuid().nullable()),
  nivel: z.enum(["BASICO", "INTERMEDIO", "AVANZADO"]),
  modalidad: z.enum(["PRESENCIAL", "VIRTUAL", "SEMIPRESENCIAL"]),
  precio: z.coerce.number().min(0, "El precio no puede ser negativo"),
  cupo: z.coerce.number().int().min(1, "El cupo debe ser al menos 1"),
  horas: z.coerce.number().int().min(0),
  estado: z.enum(["BORRADOR", "PUBLICADO", "DESPUBLICADO"]),
  destacado: z.preprocess((v) => v === "on", z.boolean()),
  publicarEn: z.preprocess(vacioANull, z.string().nullable()),
  imagen: z.preprocess(vacioANull, z.url("La imagen debe ser una URL").nullable()),
});

export async function guardarCurso(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const usuario = await admin();
  const d = cursoSchema.safeParse(Object.fromEntries(formData));
  if (!d.success) return fallo(d.error);
  const c = d.data;
  const supabase = await createClient();
  const fila = {
    titulo: c.titulo,
    descripcion: c.descripcion || null,
    categoria_id: c.categoriaId,
    instructor_id: c.instructorId,
    nivel: c.nivel,
    modalidad: c.modalidad,
    precio: c.precio,
    cupo_maximo: c.cupo,
    duracion_horas: c.horas,
    estado: c.estado,
    destacado: c.destacado,
    publicar_en: c.publicarEn ? new Date(`${c.publicarEn}:00-05:00`).toISOString() : null,
    imagen_url: c.imagen,
  };
  const { error } = c.id
    ? await supabase.from("cursos").update(fila).eq("id", c.id)
    : await supabase.from("cursos").insert({ ...fila, slug: await slugUnico(c.titulo) });
  if (error) return { ok: false, mensaje: `No se pudo guardar: ${error.message}` };
  await registrarActividad(usuario.id, c.id ? "EDITAR_CURSO" : "CREAR_CURSO", { titulo: c.titulo, estado: c.estado });
  revalidatePath("/", "layout");
  return { ok: true, mensaje: c.id ? "Curso actualizado" : "Curso creado" };
}

export async function cambiarEstadoCurso(formData: FormData) {
  const usuario = await admin();
  const id = z.uuid().parse(formData.get("id"));
  const estado = z.enum(["PUBLICADO", "DESPUBLICADO", "BORRADOR"]).parse(formData.get("estado"));
  const supabase = await createClient();
  await supabase.from("cursos").update({ estado }).eq("id", id);
  await registrarActividad(usuario.id, estado === "PUBLICADO" ? "PUBLICAR_CURSO" : "DESPUBLICAR_CURSO", { curso: id });
  revalidatePath("/", "layout");
}

export async function duplicarCurso(formData: FormData) {
  const usuario = await admin();
  const id = z.uuid().parse(formData.get("id"));
  const supabase = await createClient();
  // Se copian solo los datos del curso: la copia nace en borrador, sin publicación programada.
  const { data: original } = await supabase
    .from("cursos")
    .select("titulo, descripcion, imagen_url, nivel, modalidad, precio, cupo_maximo, duracion_horas, categoria_id, instructor_id, modulos(titulo, orden)")
    .eq("id", id)
    .single();
  if (!original) return;
  const { modulos, ...resto } = original;
  const titulo = `${original.titulo} (copia)`;
  const { data: copia } = await supabase
    .from("cursos")
    .insert({ ...resto, titulo, slug: await slugUnico(titulo), estado: "BORRADOR", destacado: false })
    .select("id")
    .single();
  if (copia && modulos?.length) {
    await supabase.from("modulos").insert(modulos.map((m) => ({ ...m, curso_id: copia.id })));
  }
  await registrarActividad(usuario.id, "DUPLICAR_CURSO", { original: id, copia: copia?.id });
  revalidatePath("/admin/cursos");
}

export async function eliminarCurso(formData: FormData): Promise<EstadoFormulario> {
  const usuario = await admin();
  const id = z.uuid().parse(formData.get("id"));
  const supabase = await createClient();
  const { error } = await supabase.from("cursos").delete().eq("id", id);
  if (error) {
    // inscripciones.curso_id es ON DELETE RESTRICT: no se borran cursos con matrículas.
    return { ok: false, mensaje: "El curso tiene inscripciones; despublícalo en lugar de eliminarlo." };
  }
  await registrarActividad(usuario.id, "ELIMINAR_CURSO", { curso: id });
  revalidatePath("/", "layout");
  return { ok: true, mensaje: "Curso eliminado" };
}

// ---------- Categorías (HU-18) ----------
const categoriaSchema = z.object({
  id: z.preprocess(vacioANull, z.coerce.number().int().nullable()),
  nombre: z.string().trim().min(3, "Escribe el nombre").max(80),
  descripcion: z.string().trim().max(300).optional(),
});

export async function guardarCategoria(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const usuario = await admin();
  const d = categoriaSchema.safeParse(Object.fromEntries(formData));
  if (!d.success) return fallo(d.error);
  const supabase = await createClient();
  const fila = { nombre: d.data.nombre, slug: slugDe(d.data.nombre), descripcion: d.data.descripcion || null };
  const { error } = d.data.id
    ? await supabase.from("categorias").update(fila).eq("id", d.data.id)
    : await supabase.from("categorias").insert(fila);
  if (error) return { ok: false, mensaje: error.code === "23505" ? "Ya existe una categoría con ese nombre" : error.message };
  await registrarActividad(usuario.id, "GUARDAR_CATEGORIA", { nombre: d.data.nombre });
  revalidatePath("/", "layout");
  return { ok: true, mensaje: "Categoría guardada" };
}

export async function eliminarCategoria(formData: FormData) {
  await admin();
  const id = z.coerce.number().int().parse(formData.get("id"));
  const supabase = await createClient();
  await supabase.from("categorias").delete().eq("id", id); // los cursos quedan sin categoría (ON DELETE SET NULL)
  revalidatePath("/", "layout");
}

// ---------- Inscripciones y pagos (HU-07 · HU-12 · HU-17) ----------
export async function resolverPago(formData: FormData) {
  const usuario = await admin();
  const inscripcionId = z.uuid().parse(formData.get("inscripcionId"));
  const aprobar = formData.get("decision") === "aprobar";
  const db = createAdminClient();

  const { data: ins } = await db
    .from("inscripciones")
    .select("id, codigo, estado, estudiante_id, estudiante:perfiles(nombres, correo), curso:cursos(titulo, slug)")
    .eq("id", inscripcionId)
    .single();
  // Solo se resuelve una vez (evita confirmar dos veces y duplicar correos).
  if (!ins || ins.estado !== "PENDIENTE") return;
  await db
    .from("pagos")
    .update(aprobar ? { estado: "APROBADO", fecha_pago: new Date().toISOString(), observacion: null } : { estado: "RECHAZADO", fecha_pago: null })
    .eq("inscripcion_id", inscripcionId);
  await db.from("inscripciones").update({ estado: aprobar ? "CONFIRMADA" : "CANCELADA" }).eq("id", inscripcionId);

  const curso = uno<{ titulo: string; slug: string }>(ins.curso);
  const estudiante = uno<{ nombres: string; correo: string }>(ins.estudiante);
  await notificar(
    ins.estudiante_id,
    aprobar
      ? `¡Tu inscripción en ${curso?.titulo ?? "el curso"} fue confirmada! Ya puedes ingresar al aula virtual.`
      : `No pudimos validar el pago de tu inscripción ${ins.codigo}. Si aún hay cupos, puedes volver a inscribirte.`,
    aprobar ? "/estudiante/cursos" : "/estudiante/pagos",
  );
  if (estudiante?.correo && curso) {
    const datos = { nombre: estudiante.nombres || "estudiante", curso: curso.titulo, codigo: ins.codigo };
    programarCorreo({
      para: estudiante.correo,
      ...(aprobar
        ? correoConfirmacionMatricula({ ...datos, url: `${publicEnv.NEXT_PUBLIC_SITE_URL}/estudiante/cursos` })
        : correoPagoRechazado({ ...datos, url: `${publicEnv.NEXT_PUBLIC_SITE_URL}/cursos/${curso.slug}` })),
    });
  }
  await registrarActividad(usuario.id, aprobar ? "CONFIRMAR_PAGO" : "RECHAZAR_PAGO", { inscripcion: ins.codigo });
  // TODO: emitir comprobante electrónico (SUNAT) al aprobar.
  revalidatePath("/admin", "layout");
}

const observacionSchema = z.object({
  inscripcionId: z.uuid(),
  motivo: z.string().trim().min(5, "Indica qué debe corregir el estudiante").max(300),
});

/**
 * Validar comprobantes · devuelve un pago manual al estudiante para que corrija
 * el N.º de operación o la captura, sin cancelar su inscripción (que bloquearía
 * una nueva matrícula en el mismo curso).
 */
export async function observarPago(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const usuario = await admin();
  const d = observacionSchema.safeParse(Object.fromEntries(formData));
  if (!d.success) return fallo(d.error);
  const db = createAdminClient();

  const { data: ins } = await db
    .from("inscripciones")
    .select("id, codigo, estado, estudiante_id, estudiante:perfiles(nombres, correo), curso:cursos(titulo), pagos(id, estado, numero_operacion)")
    .eq("id", d.data.inscripcionId)
    .single();
  const pago = uno<{ id: string; estado: string; numero_operacion: string | null }>(ins?.pagos);
  if (!ins || !pago || ins.estado !== "PENDIENTE" || pago.estado !== "PENDIENTE") return { ok: false, mensaje: "El pago ya no está pendiente" };

  const { error } = await db
    .from("pagos")
    .update({ observacion: d.data.motivo, numero_operacion: null, voucher_ruta: null, reportado_en: null })
    .eq("id", pago.id);
  if (error) return { ok: false, mensaje: error.message };
  // El estudiante tiene de nuevo el plazo completo para corregir el pago.
  const venceEn = new Date(Date.now() + PLAZO_PAGO_HORAS * 3600 * 1000);
  await db.from("inscripciones").update({ vence_en: venceEn.toISOString() }).eq("id", ins.id);

  const curso = uno<{ titulo: string }>(ins.curso);
  await notificar(
    ins.estudiante_id,
    `Revisamos tu pago de ${curso?.titulo ?? "tu curso"}: ${d.data.motivo}. Corrígelo en «Pagos» antes del ${formatearFechaHora(venceEn)}.`,
    "/estudiante/pagos",
  );
  const estudiante = uno<{ nombres: string; correo: string }>(ins.estudiante);
  if (estudiante?.correo) {
    programarCorreo({
      para: estudiante.correo,
      ...correoPagoObservado({
        nombre: estudiante.nombres || "estudiante",
        curso: curso?.titulo ?? "tu curso",
        motivo: d.data.motivo,
        venceEn: formatearFechaHora(venceEn),
        url: `${publicEnv.NEXT_PUBLIC_SITE_URL}/estudiante/pagos`,
      }),
    });
  }
  await registrarActividad(usuario.id, "OBSERVAR_PAGO", { inscripcion: ins.codigo, numero_operacion: pago.numero_operacion, motivo: d.data.motivo });
  revalidatePath("/admin", "layout");
  return { ok: true, mensaje: "Pago devuelto al estudiante para corrección" };
}

export async function resolverReembolso(formData: FormData) {
  const usuario = await admin();
  const id = z.coerce.number().int().parse(formData.get("id"));
  const aprobar = formData.get("decision") === "aprobar";
  const db = createAdminClient();
  const { data: r } = await db.from("reembolsos").select("id, pago:pagos(id, inscripcion_id, inscripcion:inscripciones(estudiante_id))").eq("id", id).single();
  if (!r) return;
  await db.from("reembolsos").update({ estado: aprobar ? "APROBADO" : "RECHAZADO" }).eq("id", id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pago = (Array.isArray(r.pago) ? r.pago[0] : r.pago) as any;
  if (aprobar && pago) {
    // TODO: ejecutar getPasarela().reembolsar(...) y marcar el reembolso como PROCESADO.
    await db.from("pagos").update({ estado: "REEMBOLSADO" }).eq("id", pago.id);
    await db.from("inscripciones").update({ estado: "CANCELADA" }).eq("id", pago.inscripcion_id);
  }
  const estudiante = (Array.isArray(pago?.inscripcion) ? pago.inscripcion[0] : pago?.inscripcion)?.estudiante_id;
  if (estudiante) await notificar(estudiante, aprobar ? "Tu solicitud de reembolso fue aprobada." : "Tu solicitud de reembolso fue rechazada.", "/estudiante/pagos");
  await registrarActividad(usuario.id, aprobar ? "APROBAR_REEMBOLSO" : "RECHAZAR_REEMBOLSO", { reembolso: id });
  revalidatePath("/admin", "layout");
}

// ---------- Cupones (HU-32) ----------
const cuponSchema = z.object({
  codigo: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{4,20}$/, "Usa de 4 a 20 letras o números, sin espacios"),
  porcentaje: z.coerce.number().min(1).max(100),
  vigencia: z.iso.date("Fecha no válida"),
  usos: z.preprocess(vacioANull, z.coerce.number().int().positive().nullable()),
});

export async function crearCupon(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const usuario = await admin();
  const d = cuponSchema.safeParse(Object.fromEntries(formData));
  if (!d.success) return fallo(d.error);
  const supabase = await createClient();
  const { error } = await supabase
    .from("cupones")
    .insert({ codigo: d.data.codigo, porcentaje_descuento: d.data.porcentaje, fecha_vigencia: d.data.vigencia, usos_maximos: d.data.usos });
  if (error) return { ok: false, mensaje: error.code === "23505" ? "Ese código ya existe" : error.message };
  await registrarActividad(usuario.id, "CREAR_CUPON", { codigo: d.data.codigo });
  revalidatePath("/admin/cupones");
  return { ok: true, mensaje: `Cupón ${d.data.codigo} creado` };
}

export async function alternarCupon(formData: FormData) {
  await admin();
  const id = z.coerce.number().int().parse(formData.get("id"));
  const activo = formData.get("activo") === "true";
  const supabase = await createClient();
  await supabase.from("cupones").update({ activo }).eq("id", id);
  revalidatePath("/admin/cupones");
}

// ---------- Certificados (HU-11 · HU-60) ----------
const emisionSchema = z.object({
  ids: z.array(z.uuid()).min(1, "Selecciona al menos un estudiante"),
  // Motivo para emitir a quien no cumple los requisitos (p. ej. faltas justificadas).
  motivo: z.preprocess((v) => (typeof v === "string" && v.trim() ? v.trim() : undefined), z.string().min(10, "Explica el motivo de la excepción (mínimo 10 caracteres)").max(300).optional()),
});

/**
 * Emite los certificados de las inscripciones confirmadas que cumplen los requisitos
 * (evaluarAptitud). Las que no los cumplen solo se emiten si el administrador indica un
 * motivo, que queda en el certificado (no se publica) y en la auditoría. Los datos del
 * documento (nombre, curso, horas, instructor, nota y asistencia) se congelan al emitir.
 */
export async function emitirCertificados(formData: FormData): Promise<EstadoFormulario> {
  const usuario = await admin();
  const d = emisionSchema.safeParse({ ids: formData.getAll("inscripcion"), motivo: formData.get("motivo") });
  if (!d.success) return fallo(d.error);
  const { ids, motivo } = d.data;
  const supabase = await createClient();
  const [{ data: filas }, resultados] = await Promise.all([
    supabase
      .from("inscripciones")
      .select(
        "id, estudiante_id, estudiante:perfiles(nombres, apellidos, correo), curso:cursos(titulo, duracion_horas, instructor:perfiles(nombres, apellidos))",
      )
      .in("id", ids)
      .eq("estado", "CONFIRMADA"),
    obtenerResultados(ids),
  ]);

  let emitidos = 0;
  let excepciones = 0;
  const omitidos: string[] = [];
  for (const ins of filas ?? []) {
    const estudiante = uno<{ nombres: string; apellidos: string; correo: string }>(ins.estudiante);
    const curso = uno<{ titulo: string; duracion_horas: number; instructor: unknown }>(ins.curso);
    const resultado = resultados.get(ins.id);
    const { apto, motivos } = evaluarAptitud(resultado);
    if (!apto && !motivo) {
      omitidos.push(`${nombreCompleto(estudiante) || estudiante?.correo}: ${motivos.join("; ")}`);
      continue;
    }

    const codigo = generarCodigoCertificado();
    const { error } = await supabase.from("certificados").insert({
      inscripcion_id: ins.id,
      codigo_unico: codigo,
      estudiante_nombre: nombreCompleto(estudiante) || estudiante?.correo || "",
      curso_titulo: curso?.titulo ?? "",
      duracion_horas: curso?.duracion_horas ?? 0,
      instructor_nombre: nombreCompleto(uno<{ nombres: string; apellidos: string }>(curso?.instructor)) || null,
      nota_final: resultado?.nota_final ?? null,
      asistencia: resultado?.asistencia ?? null,
      motivo_excepcion: apto ? null : motivo,
    });
    if (error) continue; // ya tenía certificado (inscripcion_id es único)
    emitidos++;
    if (!apto) excepciones++;
    await notificar(ins.estudiante_id, `¡Felicidades! Ya puedes descargar tu certificado de ${curso?.titulo ?? "tu curso"}.`, "/estudiante/certificados");
    if (estudiante?.correo) {
      programarCorreo({
        para: estudiante.correo,
        ...correoCertificadoEmitido({
          nombre: estudiante.nombres || "estudiante",
          curso: curso?.titulo ?? "tu curso",
          codigo,
          url: `${publicEnv.NEXT_PUBLIC_SITE_URL}/verificar?codigo=${codigo}`,
        }),
      });
    }
    await registrarActividad(usuario.id, apto ? "EMITIR_CERTIFICADO" : "EMITIR_CERTIFICADO_EXCEPCION", {
      codigo,
      inscripcion: ins.id,
      nota_final: resultado?.nota_final ?? null,
      asistencia: resultado?.asistencia ?? null,
      ...(apto ? {} : { motivo, requisitos_no_cumplidos: motivos }),
    });
  }
  revalidatePath("/admin/certificados");

  const partes = [
    emitidos && `${emitidos} certificado(s) emitido(s)${excepciones ? ` (${excepciones} como excepción)` : ""}`,
    omitidos.length && `${omitidos.length} sin emitir por no cumplir los requisitos — ${omitidos.join(" · ")}`,
  ].filter(Boolean);
  return { ok: emitidos > 0, mensaje: partes.join(". ") || "No se emitió ningún certificado" };
}

// ---------- Usuarios y roles (HU-03 · HU-34 · HU-53) ----------
export async function cambiarRol(formData: FormData) {
  const usuario = await admin();
  const id = z.uuid().parse(formData.get("id"));
  const rol = z.enum(["administrador", "instructor", "estudiante"]).parse(formData.get("rol"));
  if (id === usuario.id) return; // evita quitarse el rol de administrador por error
  const supabase = await createClient();
  await supabase.from("perfiles").update({ rol }).eq("id", id);
  await registrarActividad(usuario.id, "CAMBIAR_ROL", { usuario: id, rol });
  revalidatePath("/admin/usuarios");
}

export async function alternarUsuario(formData: FormData) {
  const usuario = await admin();
  const id = z.uuid().parse(formData.get("id"));
  const estado = formData.get("estado") === "true";
  if (id === usuario.id) return;
  const supabase = await createClient();
  await supabase.from("perfiles").update({ estado }).eq("id", id);
  await registrarActividad(usuario.id, estado ? "ACTIVAR_USUARIO" : "DESACTIVAR_USUARIO", { usuario: id });
  revalidatePath("/admin/usuarios");
}

const invitacionSchema = z.object({
  nombres: z.string().trim().min(2, "Escribe los nombres"),
  apellidos: z.string().trim().min(2, "Escribe los apellidos"),
  correo: z.email("Correo no válido"),
  rol: z.enum(["administrador", "instructor", "estudiante"]),
  especialidad: z.string().trim().max(120).optional(),
});

export async function invitarUsuario(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const usuario = await admin();
  const d = invitacionSchema.safeParse(Object.fromEntries(formData));
  if (!d.success) return fallo(d.error);
  const db = createAdminClient();
  const { data, error } = await db.auth.admin.inviteUserByEmail(d.data.correo, {
    data: { nombres: d.data.nombres, apellidos: d.data.apellidos },
    redirectTo: `${publicEnv.NEXT_PUBLIC_SITE_URL}/auth/confirm?next=/cuenta/nueva-contrasena`,
  });
  if (error || !data.user) return { ok: false, mensaje: error?.message ?? "No se pudo invitar al usuario" };
  // El trigger crea el perfil como estudiante; aquí se asigna el rol elegido.
  await db.from("perfiles").update({ rol: d.data.rol, especialidad: d.data.especialidad || null }).eq("id", data.user.id);
  await registrarActividad(usuario.id, "INVITAR_USUARIO", { correo: d.data.correo, rol: d.data.rol });
  revalidatePath("/admin/usuarios");
  return { ok: true, mensaje: `Invitación enviada a ${d.data.correo}` };
}
