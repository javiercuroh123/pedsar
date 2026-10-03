"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { uno } from "@/features/academico/consultas";
import type { EstadoFormulario } from "@/features/usuarios/esquemas";
import { registrarActividad } from "@/lib/auditoria";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const resenaSchema = z.object({
  inscripcionId: z.uuid(),
  estrellas: z.coerce.number().int("Elige de 1 a 5 estrellas").min(1, "Elige de 1 a 5 estrellas").max(5, "Elige de 1 a 5 estrellas"),
  texto: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() || null : null),
    z.string().max(500, "La reseña puede tener hasta 500 caracteres").nullable(),
  ),
});

/**
 * HU-24 · Guarda (o edita) la reseña de una inscripción. La BD solo la acepta si el curso
 * está completado (100 % de avance o certificado) y toma el curso y el autor de la
 * inscripción; el estudiante no puede cambiar si está oculta.
 */
export async function guardarResena(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const estudiante = await requireRol("estudiante");
  const d = resenaSchema.safeParse(Object.fromEntries(formData));
  if (!d.success) return { ok: false, mensaje: d.error.issues[0]?.message ?? "Datos no válidos" };
  const supabase = await createClient();

  const { data: ins } = await supabase
    .from("inscripciones")
    .select("id, curso_id, curso:cursos(slug)")
    .eq("id", d.data.inscripcionId)
    .eq("estudiante_id", estudiante.id)
    .maybeSingle();
  if (!ins) return { ok: false, mensaje: "No encontramos tu inscripción" };

  const { error } = await supabase
    .from("resenas")
    .upsert(
      { inscripcion_id: ins.id, curso_id: ins.curso_id, estudiante_id: estudiante.id, estrellas: d.data.estrellas, texto: d.data.texto },
      { onConflict: "inscripcion_id" },
    );
  if (error) {
    return { ok: false, mensaje: error.code === "42501" ? "Podrás calificar el curso cuando lo completes" : "No se pudo guardar tu reseña" };
  }

  await registrarActividad(estudiante.id, "RESENA_GUARDADA", { inscripcion: ins.id, estrellas: d.data.estrellas });
  const slug = uno<{ slug: string }>(ins.curso)?.slug;
  if (slug) revalidatePath(`/cursos/${slug}`);
  revalidatePath(`/estudiante/cursos/${ins.curso_id}`);
  return { ok: true, mensaje: "¡Gracias por tu reseña!" };
}

/** Moderación: el administrador oculta una reseña (no se publica ni cuenta en el promedio) o la vuelve a mostrar. */
export async function alternarResena(formData: FormData): Promise<void> {
  const usuario = await requireRol("administrador");
  const id = z.coerce.number().int().positive().parse(formData.get("id"));
  const oculta = formData.get("oculta") === "true";
  const supabase = await createClient();
  await supabase.from("resenas").update({ oculta }).eq("id", id);
  await registrarActividad(usuario.id, oculta ? "OCULTAR_RESENA" : "MOSTRAR_RESENA", { resena: id });
  revalidatePath("/", "layout");
}
