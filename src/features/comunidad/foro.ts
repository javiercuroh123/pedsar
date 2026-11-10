"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { notificarUsuario } from "@/features/notificaciones/enviar";
import type { EstadoFormulario } from "@/features/usuarios/esquemas";
import { registrarActividad } from "@/lib/auditoria";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const vacioAUndefined = (v: unknown) => (v === "" || v === null ? undefined : v);

const temaSchema = z.object({
  cursoId: z.uuid(),
  contenidoId: z.preprocess(vacioAUndefined, z.coerce.number().int().positive().optional()),
  titulo: z
    .string()
    .trim()
    .min(3, "Escribe un título más descriptivo")
    .max(200, "El título puede tener hasta 200 caracteres"),
  cuerpo: z
    .string()
    .trim()
    .min(3, "Escribe tu pregunta o comentario")
    .max(3000, "El mensaje puede tener hasta 3000 caracteres"),
});

const respuestaSchema = z.object({
  temaId: z.coerce.number().int().positive(),
  texto: z
    .string()
    .trim()
    .min(2, "Escribe tu respuesta")
    .max(2000, "La respuesta puede tener hasta 2000 caracteres"),
});

/**
 * HU-22 · HU-23 · Publica un tema en el foro general del curso (`contenidoId` vacío)
 * o una pregunta/comentario asociado a una lección específica (`contenidoId` presente).
 */
export async function crearTemaForo(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const usuario = await requireRol("estudiante", "instructor", "administrador");
  const d = temaSchema.safeParse(Object.fromEntries(formData));
  if (!d.success) return { ok: false, mensaje: d.error.issues[0]?.message ?? "Datos no válidos" };
  const { cursoId, contenidoId, titulo, cuerpo } = d.data;
  const supabase = await createClient();

  const { error } = await supabase.from("foro_temas").insert({
    curso_id: cursoId,
    contenido_id: contenidoId ?? null,
    autor_id: usuario.id,
    titulo,
    cuerpo,
  });
  if (error) return { ok: false, mensaje: "No se pudo publicar el tema" };

  const { data: curso } = await supabase
    .from("cursos")
    .select("titulo, instructor_id")
    .eq("id", cursoId)
    .maybeSingle();
  if (curso?.instructor_id && curso.instructor_id !== usuario.id) {
    await notificarUsuario(
      curso.instructor_id,
      `Nueva consulta en el foro · ${curso.titulo}: ${titulo}`,
      `/instructor/contenidos?curso=${cursoId}`,
    );
  }

  await registrarActividad(usuario.id, "PUBLICAR_TEMA_FORO", {
    curso: cursoId,
    contenido: contenidoId ?? null,
  });
  revalidatePath(`/estudiante/cursos/${cursoId}`);
  revalidatePath("/instructor/contenidos");
  return {
    ok: true,
    mensaje: contenidoId ? "Pregunta publicada en la lección" : "Tema publicado en el foro",
  };
}

/** HU-22 · HU-23 · Publica una respuesta dentro de un hilo del foro o pregunta de lección. */
export async function responderTemaForo(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const usuario = await requireRol("estudiante", "instructor", "administrador");
  const d = respuestaSchema.safeParse(Object.fromEntries(formData));
  if (!d.success) return { ok: false, mensaje: d.error.issues[0]?.message ?? "Datos no válidos" };
  const { temaId, texto } = d.data;
  const supabase = await createClient();

  const { data: tema } = await supabase
    .from("foro_temas")
    .select("id, curso_id, contenido_id, autor_id, titulo")
    .eq("id", temaId)
    .maybeSingle();
  if (!tema) return { ok: false, mensaje: "No encontramos ese tema" };

  const { error } = await supabase.from("foro_respuestas").insert({
    tema_id: tema.id,
    autor_id: usuario.id,
    texto,
  });
  if (error) return { ok: false, mensaje: "No se pudo publicar la respuesta" };

  if (tema.autor_id !== usuario.id) {
    const sufijo = tema.contenido_id ? `?c=${tema.contenido_id}` : "";
    await notificarUsuario(
      tema.autor_id,
      `Nueva respuesta en «${tema.titulo}»`,
      `/estudiante/cursos/${tema.curso_id}${sufijo}`,
    );
  }

  await registrarActividad(usuario.id, "RESPONDER_TEMA_FORO", { tema: tema.id });
  revalidatePath(`/estudiante/cursos/${tema.curso_id}`);
  revalidatePath("/instructor/contenidos");
  return { ok: true, mensaje: "Respuesta publicada" };
}

/** HU-23 · Marca una duda como resuelta (o la reabre) por parte de su autor o del instructor. */
export async function alternarTemaResuelto(formData: FormData): Promise<void> {
  const usuario = await requireRol("estudiante", "instructor", "administrador");
  const id = z.coerce.number().int().positive().parse(formData.get("id"));
  const resuelto = formData.get("resuelto") === "true";
  const supabase = await createClient();
  await supabase
    .from("foro_temas")
    .update({ resuelto, actualizado_en: new Date().toISOString() })
    .eq("id", id);
  await registrarActividad(
    usuario.id,
    resuelto ? "MARCAR_TEMA_RESUELTO" : "REABRIR_TEMA_FORO",
    { tema: id },
  );
  revalidatePath("/estudiante/cursos", "layout");
  revalidatePath("/instructor/contenidos");
}

/** Elimina un tema propio o moderado por el instructor/administrador. */
export async function eliminarTemaForo(formData: FormData): Promise<void> {
  const usuario = await requireRol("estudiante", "instructor", "administrador");
  const id = z.coerce.number().int().positive().parse(formData.get("id"));
  const supabase = await createClient();
  await supabase.from("foro_temas").delete().eq("id", id);
  await registrarActividad(usuario.id, "ELIMINAR_TEMA_FORO", { tema: id });
  revalidatePath("/estudiante/cursos", "layout");
  revalidatePath("/instructor/contenidos");
}
