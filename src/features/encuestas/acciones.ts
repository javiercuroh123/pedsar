"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { EstadoFormulario } from "@/features/usuarios/esquemas";
import { registrarActividad } from "@/lib/auditoria";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { obtenerEncuestaParaResponder } from "./consultas";
import { ASPECTOS, validarRespuestas } from "./resultados";

const admin = () => requireRol("administrador");
const fallo = (e: z.ZodError): EstadoFormulario => ({ ok: false, mensaje: e.issues[0]?.message ?? "Datos no válidos" });
const id = z.coerce.number().int().positive();

// ---------------------------------------------------------------------
// Estudiante
// ---------------------------------------------------------------------

/** HU-43 · El estudiante responde su encuesta (la BD verifica que sea suya y que no la haya respondido). */
export async function responderEncuesta(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const estudiante = await requireRol("estudiante");
  const envioId = id.safeParse(formData.get("envioId"));
  if (!envioId.success) return { ok: false, mensaje: "Encuesta no encontrada" };
  const encuesta = await obtenerEncuestaParaResponder(envioId.data);
  if (!encuesta) return { ok: false, mensaje: "Encuesta no encontrada" };
  if (encuesta.respondidaEn) return { ok: false, mensaje: "Ya respondiste esta encuesta" };

  const crudas = Object.fromEntries([...formData.entries()].filter(([k]) => k.startsWith("r:")).map(([k, v]) => [k.slice(2), v]));
  const v = validarRespuestas(encuesta.preguntas, crudas);
  if (!v.ok) return v;

  const supabase = await createClient();
  const { error } = await supabase.rpc("responder_encuesta", { p_envio: envioId.data, p_respuestas: v.datos });
  if (error) return { ok: false, mensaje: error.code === "23505" ? "Ya respondiste esta encuesta" : "No se pudo guardar tu respuesta" };
  await registrarActividad(estudiante.id, "RESPONDER_ENCUESTA", { envio: envioId.data });
  revalidatePath("/estudiante", "layout");
  return { ok: true, mensaje: "¡Gracias! Tu opinión nos ayuda a mejorar" };
}

// ---------------------------------------------------------------------
// Administrador
// ---------------------------------------------------------------------

const encuestaSchema = z.object({
  titulo: z.string().trim().min(3, "Escribe un título de al menos 3 caracteres").max(120),
  descripcion: z.string().trim().max(500, "La descripción admite hasta 500 caracteres").optional(),
});

export async function crearEncuesta(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const usuario = await admin();
  const d = encuestaSchema.safeParse(Object.fromEntries(formData));
  if (!d.success) return fallo(d.error);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("encuestas")
    .insert({ titulo: d.data.titulo, descripcion: d.data.descripcion || null, creada_por: usuario.id })
    .select("id")
    .single();
  if (error || !data) return { ok: false, mensaje: "No se pudo crear la encuesta" };
  await registrarActividad(usuario.id, "CREAR_ENCUESTA", { encuesta: data.id });
  revalidatePath("/admin/encuestas");
  redirect(`/admin/encuestas/${data.id}`);
}

export async function actualizarEncuesta(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const usuario = await admin();
  const encuestaId = id.safeParse(formData.get("id"));
  const d = encuestaSchema.safeParse(Object.fromEntries(formData));
  if (!encuestaId.success) return { ok: false, mensaje: "Encuesta no encontrada" };
  if (!d.success) return fallo(d.error);
  const supabase = await createClient();
  const { error } = await supabase.from("encuestas").update({ titulo: d.data.titulo, descripcion: d.data.descripcion || null }).eq("id", encuestaId.data);
  if (error) return { ok: false, mensaje: "No se pudo guardar la encuesta" };
  await registrarActividad(usuario.id, "EDITAR_ENCUESTA", { encuesta: encuestaId.data });
  revalidatePath("/admin/encuestas", "layout");
  return { ok: true, mensaje: "Encuesta actualizada" };
}

const preguntaSchema = z
  .object({
    encuestaId: id,
    enunciado: z.string().trim().min(3, "Escribe la pregunta (al menos 3 caracteres)").max(200, "La pregunta admite hasta 200 caracteres"),
    tipo: z.enum(["ESCALA", "TEXTO"]),
    aspecto: z.union([z.enum(ASPECTOS), z.literal("")]).optional(),
    obligatoria: z.literal("on").optional(),
  })
  .refine((p) => p.tipo === "TEXTO" || !!p.aspecto, { message: "Elige qué aspecto mide la pregunta", path: ["aspecto"] });

/** Agrega una pregunta al final. La BD la rechaza si la encuesta ya se envió. */
export async function agregarPregunta(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const usuario = await admin();
  const d = preguntaSchema.safeParse(Object.fromEntries(formData));
  if (!d.success) return fallo(d.error);
  const supabase = await createClient();
  const { data: ultima } = await supabase
    .from("encuesta_preguntas")
    .select("orden")
    .eq("encuesta_id", d.data.encuestaId)
    .order("orden", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase.from("encuesta_preguntas").insert({
    encuesta_id: d.data.encuestaId,
    orden: (ultima?.orden ?? 0) + 1,
    enunciado: d.data.enunciado,
    tipo: d.data.tipo,
    aspecto: d.data.tipo === "ESCALA" ? d.data.aspecto || null : null,
    obligatoria: d.data.obligatoria === "on",
  });
  if (error) return { ok: false, mensaje: error.code === "23514" ? "La encuesta ya fue enviada: duplícala para cambiar sus preguntas" : "No se pudo agregar la pregunta" };
  await registrarActividad(usuario.id, "EDITAR_ENCUESTA", { encuesta: d.data.encuestaId });
  revalidatePath(`/admin/encuestas/${d.data.encuestaId}`);
  return { ok: true, mensaje: "Pregunta agregada" };
}

export async function eliminarPregunta(formData: FormData): Promise<EstadoFormulario> {
  const usuario = await admin();
  const preguntaId = id.parse(formData.get("id"));
  const encuestaId = id.parse(formData.get("encuestaId"));
  const supabase = await createClient();
  const { error } = await supabase.from("encuesta_preguntas").delete().eq("id", preguntaId).eq("encuesta_id", encuestaId);
  if (error) return { ok: false, mensaje: "La encuesta ya fue enviada: duplícala para cambiar sus preguntas" };
  await registrarActividad(usuario.id, "EDITAR_ENCUESTA", { encuesta: encuestaId });
  revalidatePath(`/admin/encuestas/${encuestaId}`);
  return { ok: true, mensaje: "Pregunta eliminada" };
}

/** Deja una sola encuesta activa: la que se enviará al emitirse cada certificado. */
export async function activarEncuesta(formData: FormData): Promise<EstadoFormulario> {
  const usuario = await admin();
  const encuestaId = id.parse(formData.get("id"));
  const activar = formData.get("activa") !== "false";
  const supabase = await createClient();
  if (activar) {
    const { count } = await supabase.from("encuesta_preguntas").select("id", { count: "exact", head: true }).eq("encuesta_id", encuestaId).eq("tipo", "ESCALA");
    if (!count) return { ok: false, mensaje: "Agrega al menos una pregunta de escala antes de activarla" };
    await supabase.from("encuestas").update({ activa: false }).eq("activa", true).neq("id", encuestaId);
  }
  const { error } = await supabase.from("encuestas").update({ activa: activar }).eq("id", encuestaId);
  if (error) return { ok: false, mensaje: "No se pudo cambiar la encuesta vigente" };
  await registrarActividad(usuario.id, activar ? "ACTIVAR_ENCUESTA" : "DESACTIVAR_ENCUESTA", { encuesta: encuestaId });
  revalidatePath("/admin/encuestas", "layout");
  return { ok: true, mensaje: activar ? "Encuesta activada: se enviará al terminar cada curso" : "Encuesta desactivada: no se enviarán encuestas" };
}

/** Copia una encuesta (inactiva) con sus preguntas, para cambiarla sin alterar los resultados ya reunidos. */
export async function duplicarEncuesta(formData: FormData): Promise<EstadoFormulario> {
  const usuario = await admin();
  const encuestaId = id.parse(formData.get("id"));
  const supabase = await createClient();
  const [{ data: original }, { data: preguntas }] = await Promise.all([
    supabase.from("encuestas").select("titulo, descripcion").eq("id", encuestaId).maybeSingle(),
    supabase.from("encuesta_preguntas").select("orden, enunciado, tipo, aspecto, obligatoria").eq("encuesta_id", encuestaId).order("orden"),
  ]);
  if (!original) return { ok: false, mensaje: "Encuesta no encontrada" };
  const { data: copia, error } = await supabase
    .from("encuestas")
    .insert({ titulo: `Copia de ${original.titulo}`.slice(0, 120), descripcion: original.descripcion, creada_por: usuario.id })
    .select("id")
    .single();
  if (error || !copia) return { ok: false, mensaje: "No se pudo duplicar la encuesta" };
  if (preguntas?.length) await supabase.from("encuesta_preguntas").insert(preguntas.map((p) => ({ ...p, encuesta_id: copia.id })));
  await registrarActividad(usuario.id, "DUPLICAR_ENCUESTA", { encuesta: encuestaId, copia: copia.id });
  revalidatePath("/admin/encuestas");
  redirect(`/admin/encuestas/${copia.id}`);
}

/** Solo se eliminan encuestas que nunca se enviaron (las enviadas conservan sus resultados). */
export async function eliminarEncuesta(formData: FormData): Promise<EstadoFormulario> {
  const usuario = await admin();
  const encuestaId = id.parse(formData.get("id"));
  const supabase = await createClient();
  const { count } = await supabase.from("encuesta_envios").select("id", { count: "exact", head: true }).eq("encuesta_id", encuestaId);
  if (count) return { ok: false, mensaje: "Esta encuesta ya se envió: puedes desactivarla, pero no eliminarla" };
  const { error } = await supabase.from("encuestas").delete().eq("id", encuestaId);
  if (error) return { ok: false, mensaje: "No se pudo eliminar la encuesta" };
  await registrarActividad(usuario.id, "ELIMINAR_ENCUESTA", { encuesta: encuestaId });
  revalidatePath("/admin/encuestas");
  redirect("/admin/encuestas");
}
