import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * HU-51 · Notificaciones in-app. Se escriben con el cliente admin porque la
 * tabla no tiene política de inserción: solo el servidor crea notificaciones.
 * No va en un archivo "use server" para no exponerla como Server Action.
 */
export async function notificarUsuario(usuarioId: string, mensaje: string, enlace?: string) {
  await createAdminClient().from("notificaciones").insert({ usuario_id: usuarioId, mensaje, enlace: enlace ?? null, tipo: "IN_APP" });
}

/** Avisa a todos los administradores activos (p. ej. un pago por validar). */
export async function notificarAdministradores(mensaje: string, enlace?: string) {
  const db = createAdminClient();
  const { data: admins } = await db.from("perfiles").select("id").eq("rol", "administrador").eq("estado", true);
  if (!admins?.length) return;
  await db.from("notificaciones").insert(admins.map((a) => ({ usuario_id: a.id, mensaje, enlace: enlace ?? null, tipo: "IN_APP" as const })));
}

/** HU-21 · HU-41 · Avisa a todos los estudiantes con matrícula confirmada en un curso. */
export async function notificarInscritosDelCurso(cursoId: string, mensaje: string, enlace?: string) {
  const db = createAdminClient();
  const { data: inscritos } = await db
    .from("inscripciones")
    .select("estudiante_id")
    .eq("curso_id", cursoId)
    .eq("estado", "CONFIRMADA");
  if (!inscritos?.length) return;
  const unicos = [...new Set(inscritos.map((i: { estudiante_id: string }) => i.estudiante_id))];
  await db.from("notificaciones").insert(
    unicos.map((usuario_id) => ({ usuario_id, mensaje, enlace: enlace ?? null, tipo: "IN_APP" as const })),
  );
}
