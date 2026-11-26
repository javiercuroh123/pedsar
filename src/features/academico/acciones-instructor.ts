"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { emitirCertificadosAutomaticos } from "@/features/certificacion/emision-automatica";
import { notificarInscritosDelCurso } from "@/features/notificaciones/enviar";
import { registrarActividad } from "@/lib/auditoria";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { EstadoFormulario } from "@/features/usuarios/esquemas";

/**
 * Acciones del instructor. Todas usan el cliente con la sesión del usuario:
 * las políticas RLS (es_instructor_de / es_admin) impiden tocar cursos ajenos.
 */
const staff = () => requireRol("instructor", "administrador");
const fallo = (e: z.ZodError): EstadoFormulario => ({ ok: false, mensaje: e.issues[0]?.message ?? "Datos no válidos" });

// ---------- Contenidos (HU-08 · HU-52 · HU-55) ----------
const moduloSchema = z.object({ cursoId: z.uuid(), titulo: z.string().trim().min(3, "Escribe el título del módulo").max(160) });
const editarModuloSchema = z.object({
  id: z.coerce.number().int().positive(),
  titulo: z.string().trim().min(3, "Escribe el título del módulo").max(160),
  orden: z.preprocess((v) => (v === "" || v === undefined ? undefined : v), z.coerce.number().int().min(1, "El orden debe ser al menos 1").optional()),
});

export async function crearModulo(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const usuario = await staff();
  const d = moduloSchema.safeParse(Object.fromEntries(formData));
  if (!d.success) return fallo(d.error);
  const supabase = await createClient();
  const { count } = await supabase.from("modulos").select("id", { head: true, count: "exact" }).eq("curso_id", d.data.cursoId);
  const { error } = await supabase.from("modulos").insert({ curso_id: d.data.cursoId, titulo: d.data.titulo, orden: (count ?? 0) + 1 });
  if (error) return { ok: false, mensaje: "No tienes permiso para editar este curso" };
  await registrarActividad(usuario.id, "CREAR_MODULO", { curso: d.data.cursoId, titulo: d.data.titulo });
  revalidatePath("/instructor/contenidos");
  return { ok: true, mensaje: "Módulo agregado" };
}

export async function editarModulo(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const usuario = await staff();
  const d = editarModuloSchema.safeParse(Object.fromEntries(formData));
  if (!d.success) return fallo(d.error);
  const supabase = await createClient();
  const { error } = await supabase
    .from("modulos")
    .update({ titulo: d.data.titulo, ...(d.data.orden !== undefined && { orden: d.data.orden }) })
    .eq("id", d.data.id);
  if (error) return { ok: false, mensaje: "No tienes permiso para editar este módulo" };
  await registrarActividad(usuario.id, "EDITAR_MODULO", { modulo: d.data.id, titulo: d.data.titulo });
  revalidatePath("/instructor/contenidos");
  return { ok: true, mensaje: "Módulo actualizado" };
}

export async function eliminarModulo(formData: FormData) {
  await staff();
  const id = z.coerce.number().int().parse(formData.get("id"));
  const supabase = await createClient();
  await supabase.from("modulos").delete().eq("id", id);
  revalidatePath("/instructor/contenidos");
}

const contenidoSchema = z.object({
  moduloId: z.coerce.number().int(),
  titulo: z.string().trim().min(3, "Escribe el título").max(200),
  tipo: z.enum(["PDF", "VIDEO", "ENLACE"]),
  url: z.string().trim().min(1, "Adjunta un archivo o escribe la URL").max(1000),
});

const editarContenidoSchema = z.object({
  id: z.coerce.number().int().positive(),
  titulo: z.string().trim().min(3, "Escribe el título").max(200),
  tipo: z.enum(["PDF", "VIDEO", "ENLACE"]),
  url: z.string().trim().min(1, "Adjunta un archivo o escribe la URL").max(1000),
  orden: z.preprocess((v) => (v === "" || v === undefined ? undefined : v), z.coerce.number().int().min(1, "El orden debe ser al menos 1").optional()),
});

const esUrlVideoEmbebible = (url: string) =>
  /(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)[\w-]{11}|(?:player\.)?vimeo\.com\/(?:video\/)?\d+|drive\.google\.com\/(?:file\/d\/|open\?(?:.*&)?id=|uc\?(?:.*&)?id=)[\w-]{10,}/.test(
    url,
  );

export async function crearContenido(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const usuario = await staff();
  const d = contenidoSchema.safeParse(Object.fromEntries(formData));
  if (!d.success) return fallo(d.error);
  if (d.data.tipo === "ENLACE" && !/^https?:\/\//.test(d.data.url)) return { ok: false, mensaje: "La URL debe empezar con https://" };
  const tipoFinal = d.data.tipo === "ENLACE" && esUrlVideoEmbebible(d.data.url) ? "VIDEO" : d.data.tipo;
  const supabase = await createClient();
  const { count } = await supabase.from("contenidos").select("id", { head: true, count: "exact" }).eq("modulo_id", d.data.moduloId);
  const { error } = await supabase
    .from("contenidos")
    .insert({ modulo_id: d.data.moduloId, titulo: d.data.titulo, tipo: tipoFinal, url_archivo: d.data.url, orden: (count ?? 0) + 1 });
  if (error) return { ok: false, mensaje: "No se pudo guardar el contenido" };
  await registrarActividad(usuario.id, "SUBIR_CONTENIDO", { modulo: d.data.moduloId, titulo: d.data.titulo, tipo: tipoFinal });
  revalidatePath("/instructor/contenidos");
  return { ok: true, mensaje: "Contenido publicado en el aula" };
}

export async function editarContenido(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const usuario = await staff();
  const d = editarContenidoSchema.safeParse(Object.fromEntries(formData));
  if (!d.success) return fallo(d.error);
  if (d.data.tipo === "ENLACE" && !/^https?:\/\//.test(d.data.url)) return { ok: false, mensaje: "La URL debe empezar con https://" };
  const tipoFinal = d.data.tipo === "ENLACE" && esUrlVideoEmbebible(d.data.url) ? "VIDEO" : d.data.tipo;
  const supabase = await createClient();
  const { error } = await supabase
    .from("contenidos")
    .update({
      titulo: d.data.titulo,
      tipo: tipoFinal,
      url_archivo: d.data.url,
      ...(d.data.orden !== undefined && { orden: d.data.orden }),
    })
    .eq("id", d.data.id);
  if (error) return { ok: false, mensaje: "No se pudo actualizar el contenido" };
  await registrarActividad(usuario.id, "EDITAR_CONTENIDO", { contenido: d.data.id, titulo: d.data.titulo, tipo: tipoFinal });
  revalidatePath("/instructor/contenidos");
  return { ok: true, mensaje: "Contenido actualizado" };
}

export async function eliminarContenido(formData: FormData) {
  await staff();
  const id = z.coerce.number().int().parse(formData.get("id"));
  const supabase = await createClient();
  await supabase.from("contenidos").delete().eq("id", id);
  revalidatePath("/instructor/contenidos");
}

// ---------- Sesiones (HU-16 · HU-38 · HU-62) ----------
const sesionSchema = z.object({
  cursoId: z.uuid(),
  fecha: z.iso.date("Fecha no válida"),
  horaInicio: z.string().regex(/^\d{2}:\d{2}$/, "Hora no válida"),
  duracion: z.coerce.number().int().min(15).max(600),
  modalidad: z.enum(["VIRTUAL", "ASINCRONA"]),
  enlace: z.union([z.url("El enlace debe ser una URL válida"), z.literal("")]).optional(),
});

export async function crearSesion(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const usuario = await staff();
  const d = sesionSchema.safeParse(Object.fromEntries(formData));
  if (!d.success) return fallo(d.error);
  const supabase = await createClient();
  const { error } = await supabase.from("sesiones").insert({
    curso_id: d.data.cursoId,
    fecha: d.data.fecha,
    hora_inicio: d.data.horaInicio,
    duracion_minutos: d.data.duracion,
    modalidad: d.data.modalidad,
    enlace_virtual: d.data.enlace || null,
  });
  if (error) return { ok: false, mensaje: "No se pudo programar la sesión" };
  await notificarInscritosDelCurso(
    d.data.cursoId,
    d.data.modalidad === "ASINCRONA"
      ? `Nueva clase asíncrona disponible desde el ${d.data.fecha} a las ${d.data.horaInicio}.`
      : `Nueva sesión programada para el ${d.data.fecha} a las ${d.data.horaInicio}.`,
    "/estudiante",
  );
  await registrarActividad(usuario.id, "PROGRAMAR_SESION", { curso: d.data.cursoId, fecha: d.data.fecha });
  revalidatePath("/instructor", "layout");
  return { ok: true, mensaje: "Sesión programada" };
}

export async function eliminarSesion(formData: FormData) {
  await staff();
  const id = z.coerce.number().int().parse(formData.get("id"));
  const supabase = await createClient();
  await supabase.from("sesiones").delete().eq("id", id);
  revalidatePath("/instructor", "layout");
}

// ---------- Asistencia (HU-58 · HU-56 faltas justificadas) ----------
const MOTIVO_JUSTIFICACION = z.string().trim().min(3).max(300);

export async function guardarAsistencia(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const usuario = await staff();
  const sesionId = z.coerce.number().int().parse(formData.get("sesionId"));
  const fecha = z.iso.date().parse(formData.get("fecha"));
  const filas = [...formData.entries()]
    .filter(([k]) => k.startsWith("a:"))
    .map(([k, v]) => {
      const inscripcion_id = z.uuid().parse(k.slice(2));
      const estado = z.enum(["PRESENTE", "AUSENTE", "TARDANZA", "JUSTIFICADA"]).parse(v);
      // El motivo solo se guarda en las faltas justificadas (la BD exige lo mismo).
      const motivo = estado === "JUSTIFICADA" ? MOTIVO_JUSTIFICACION.safeParse(formData.get(`m:${inscripcion_id}`) ?? "") : null;
      return { inscripcion_id, sesion_id: sesionId, estado, motivo, fecha };
    });
  if (!filas.length) return { ok: false, mensaje: "No hay estudiantes para registrar" };
  if (filas.some((f) => f.motivo && !f.motivo.success)) {
    return { ok: false, mensaje: "Escribe el motivo de cada falta justificada (de 3 a 300 caracteres)" };
  }
  const supabase = await createClient();

  // Solo inscripciones confirmadas del mismo curso de la sesión.
  const { data: sesion } = await supabase.from("sesiones").select("curso_id, modalidad").eq("id", sesionId).maybeSingle();
  if (!sesion) return { ok: false, mensaje: "Sesión no encontrada" };
  if (sesion.modalidad === "ASINCRONA") return { ok: false, mensaje: "Las sesiones asíncronas no registran asistencia" };
  const { data: validas } = await supabase.from("inscripciones").select("id").eq("curso_id", sesion.curso_id).eq("estado", "CONFIRMADA");
  const ids = new Set((validas ?? []).map((i: { id: string }) => i.id));

  const validasCurso = filas
    .filter((f) => ids.has(f.inscripcion_id))
    .map((f) => ({ ...f, motivo: f.motivo?.success ? f.motivo.data : null }));
  const { error } = await supabase.from("asistencias").upsert(validasCurso, { onConflict: "inscripcion_id,sesion_id" });
  if (error) return { ok: false, mensaje: "No se pudo guardar la asistencia" };
  await registrarActividad(usuario.id, "REGISTRAR_ASISTENCIA", { sesion: sesionId, registros: filas.length });
  const presentes = validasCurso.filter((f) => f.estado !== "AUSENTE").map((f) => f.inscripcion_id);
  if (presentes.length) await emitirCertificadosAutomaticos(presentes, usuario.id);
  revalidatePath("/instructor", "layout");
  return { ok: true, mensaje: "Asistencia guardada correctamente" };
}

// ---------- Evaluaciones (HU-09 · HU-59) ----------
const evaluacionSchema = z.object({
  cursoId: z.uuid("Elige un curso"),
  titulo: z.string().trim().min(3, "Escribe el título").max(200),
  puntajeTotal: z.number().positive().max(100),
  intentos: z.number().int().min(1).max(10),
  tiempo: z.number().int().min(0).max(300),
  fechaLimite: z.string().optional(),
  preguntas: z
    .array(
      z.object({
        enunciado: z.string().trim().min(3, "Todas las preguntas necesitan enunciado"),
        opciones: z.array(z.string().trim().min(1, "Completa todas las opciones")).min(2).max(6),
        correcta: z.number().int().min(0),
        puntaje: z.number().positive(),
      }),
    )
    .min(1, "Agrega al menos una pregunta"),
});

export type NuevaEvaluacion = z.input<typeof evaluacionSchema>;

export async function crearEvaluacion(datos: NuevaEvaluacion): Promise<EstadoFormulario> {
  const usuario = await staff();
  const d = evaluacionSchema.safeParse(datos);
  if (!d.success) return fallo(d.error);
  const supabase = await createClient();
  const fechaLimiteIso = d.data.fechaLimite?.trim() ? new Date(`${d.data.fechaLimite.trim()}:00-05:00`).toISOString() : undefined;
  const { data: evaluacion, error } = await supabase
    .from("evaluaciones")
    .insert({
      curso_id: d.data.cursoId,
      titulo: d.data.titulo,
      puntaje_total: d.data.puntajeTotal,
      intentos_permitidos: d.data.intentos,
      tiempo_limite_min: d.data.tiempo || null,
      ...(fechaLimiteIso ? { fecha_limite: fechaLimiteIso } : {}),
    })
    .select("id")
    .single();
  if (error || !evaluacion) return { ok: false, mensaje: "No tienes permiso para crear evaluaciones en este curso" };

  // La respuesta correcta se guarda como el texto de la opción elegida.
  const { error: errorPreguntas } = await supabase.from("preguntas").insert(
    d.data.preguntas.map((p) => ({
      evaluacion_id: evaluacion.id,
      enunciado: p.enunciado,
      opciones: p.opciones,
      respuesta_correcta: p.opciones[p.correcta] ?? p.opciones[0],
      puntaje: p.puntaje,
    })),
  );
  if (errorPreguntas) {
    await supabase.from("evaluaciones").delete().eq("id", evaluacion.id);
    return { ok: false, mensaje: "No se pudieron guardar las preguntas" };
  }
  await notificarInscritosDelCurso(
    d.data.cursoId,
    `Nueva evaluación disponible: «${d.data.titulo}».`,
    `/estudiante/evaluaciones/${evaluacion.id}`,
  );
  await registrarActividad(usuario.id, "CREAR_EVALUACION", { evaluacion: evaluacion.id, preguntas: d.data.preguntas.length });
  revalidatePath("/instructor/evaluaciones");
  return { ok: true, mensaje: "Evaluación publicada" };
}

export async function eliminarEvaluacion(formData: FormData) {
  await staff();
  const id = z.coerce.number().int().parse(formData.get("id"));
  const supabase = await createClient();
  await supabase.from("evaluaciones").delete().eq("id", id);
  revalidatePath("/instructor/evaluaciones");
}
