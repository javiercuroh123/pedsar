"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { uno } from "@/features/academico/consultas";
import { notificarUsuario } from "@/features/notificaciones/enviar";
import type { EstadoFormulario } from "@/features/usuarios/esquemas";
import { requireRol } from "@/lib/auth";
import { programarCorreo } from "@/lib/email";
import { correoMensajeNuevo } from "@/lib/email/plantillas";
import { publicEnv } from "@/lib/env";
import { nombreCompleto } from "@/lib/formato";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const vacioAUndefined = (v: unknown) => (v === "" || v === null ? undefined : v);

const mensajeSchema = z.object({
  cursoId: z.preprocess(vacioAUndefined, z.uuid().optional()),
  conversacionId: z.preprocess(vacioAUndefined, z.coerce.number().int().positive().optional()),
  texto: z.string().trim().min(1, "Escribe tu mensaje").max(2000, "El mensaje no puede pasar de 2000 caracteres"),
});

/**
 * HU-19 · Envía un mensaje. El estudiante escribe al instructor del curso en el que está
 * matriculado (la conversación se crea con el primer mensaje); el instructor responde en
 * una existente. La RLS de la BD garantiza ambas reglas. El destinatario recibe un aviso
 * en la campana y, si no tenía otros mensajes sin leer, un correo.
 */
export async function enviarMensaje(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const usuario = await requireRol("estudiante", "instructor");
  const d = mensajeSchema.safeParse(Object.fromEntries(formData));
  if (!d.success) return { ok: false, mensaje: d.error.issues[0]?.message ?? "Datos no válidos" };
  const { cursoId, conversacionId, texto } = d.data;
  const supabase = await createClient();

  let conversacion: { id: number; cursoId: string; curso: string; destinatario: string; enlace: string };
  if (usuario.rol === "estudiante") {
    if (!cursoId) return { ok: false, mensaje: "Elige el curso" };
    const { data: ins } = await supabase
      .from("inscripciones")
      .select("id, curso:cursos(id, titulo, instructor_id)")
      .eq("curso_id", cursoId)
      .eq("estudiante_id", usuario.id)
      .eq("estado", "CONFIRMADA")
      .maybeSingle();
    const curso = uno<{ id: string; titulo: string; instructor_id: string | null }>(ins?.curso);
    if (!ins || !curso) return { ok: false, mensaje: "Solo puedes escribir en cursos en los que estás matriculado" };
    if (!curso.instructor_id) return { ok: false, mensaje: "Este curso aún no tiene instructor asignado" };

    const { data: existente } = await supabase.from("conversaciones").select("id").eq("curso_id", cursoId).eq("estudiante_id", usuario.id).maybeSingle();
    let id = existente?.id;
    if (!id) {
      const { data: nueva, error } = await supabase.from("conversaciones").insert({ curso_id: cursoId, estudiante_id: usuario.id }).select("id").single();
      if (error || !nueva) return { ok: false, mensaje: "No se pudo iniciar la conversación" };
      id = nueva.id;
    }
    conversacion = { id, cursoId, curso: curso.titulo, destinatario: curso.instructor_id, enlace: `/instructor/mensajes/${id}` };
  } else {
    if (!conversacionId) return { ok: false, mensaje: "Responde desde una conversación existente" };
    const { data: c } = await supabase.from("conversaciones").select("id, curso_id, estudiante_id, curso:cursos(titulo)").eq("id", conversacionId).maybeSingle();
    if (!c) return { ok: false, mensaje: "No encontramos esa conversación" };
    conversacion = {
      id: c.id,
      cursoId: c.curso_id,
      curso: uno<{ titulo: string }>(c.curso)?.titulo ?? "tu curso",
      destinatario: c.estudiante_id,
      enlace: `/estudiante/mensajes/${c.curso_id}`,
    };
  }

  // Correo solo con el primer mensaje sin leer: si ya hay otros pendientes, basta la campana.
  const { count: pendientes } = await supabase
    .from("mensajes")
    .select("id", { head: true, count: "exact" })
    .eq("conversacion_id", conversacion.id)
    .eq("autor_id", usuario.id)
    .is("leido_en", null);

  const { error } = await supabase.from("mensajes").insert({ conversacion_id: conversacion.id, autor_id: usuario.id, texto });
  if (error) return { ok: false, mensaje: "No se pudo enviar el mensaje" };

  const autor = nombreCompleto(usuario) || usuario.correo;
  await notificarUsuario(conversacion.destinatario, `Nuevo mensaje de ${autor} · ${conversacion.curso}`, conversacion.enlace);
  if (!pendientes) {
    const { data: destinatario } = await createAdminClient().from("perfiles").select("nombres, correo").eq("id", conversacion.destinatario).maybeSingle();
    if (destinatario?.correo) {
      programarCorreo({
        para: destinatario.correo,
        ...correoMensajeNuevo({
          nombre: destinatario.nombres || "hola",
          de: autor,
          curso: conversacion.curso,
          extracto: texto,
          url: `${publicEnv.NEXT_PUBLIC_SITE_URL}${conversacion.enlace}`,
        }),
      });
    }
  }

  revalidatePath(usuario.rol === "estudiante" ? `/estudiante/mensajes/${conversacion.cursoId}` : `/instructor/mensajes/${conversacion.id}`);
  revalidatePath(usuario.rol === "estudiante" ? "/estudiante/mensajes" : "/instructor/mensajes");
  return { ok: true };
}

/** Marca como leídos los mensajes del otro participante (función segura de la BD). */
export async function marcarLeidos(conversacionId: number): Promise<void> {
  const usuario = await requireRol("estudiante", "instructor");
  const supabase = await createClient();
  await supabase.rpc("marcar_leidos", { p_conversacion: conversacionId });
  revalidatePath(usuario.rol === "estudiante" ? "/estudiante/mensajes" : "/instructor/mensajes");
}
