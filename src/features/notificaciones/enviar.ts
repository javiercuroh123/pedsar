import "server-only";
import { uno } from "@/features/academico/consultas";
import { programarCorreo } from "@/lib/email";
import { correoAvisoCurso, correoRecordatorioEvaluacion, correoRecordatorioSesion } from "@/lib/email/plantillas";
import { publicEnv } from "@/lib/env";
import { ETIQUETA_TIPO_SESION, formatearFecha, formatearFechaHora, formatearHora } from "@/lib/formato";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TipoSesion } from "@/types/dominio";

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

/** HU-21 · HU-41 · Avisa a todos los estudiantes con matrícula confirmada en un curso (respetando su preferencia de canal). */
export async function notificarInscritosDelCurso(cursoId: string, mensaje: string, enlace?: string) {
  const db = createAdminClient();
  const { data: inscritos } = await db
    .from("inscripciones")
    .select("estudiante_id, estudiante:perfiles(nombres, correo, canal_notificacion), curso:cursos(titulo)")
    .eq("curso_id", cursoId)
    .eq("estado", "CONFIRMADA");
  if (!inscritos?.length) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filas = inscritos as any[];
  const permitidos = filas.filter((i) => uno<{ canal_notificacion?: string }>(i.estudiante)?.canal_notificacion !== "CORREO");
  const unicos = [...new Set(permitidos.map((i) => i.estudiante_id as string))];
  if (unicos.length) {
    await db.from("notificaciones").insert(
      unicos.map((usuario_id) => ({ usuario_id, mensaje, enlace: enlace ?? null, tipo: "IN_APP" as const })),
    );
  }
  const correosEnviados = new Set<string>();
  for (const i of filas) {
    const est = uno<{ nombres?: string; correo?: string; canal_notificacion?: string }>(i.estudiante);
    if (!est?.correo || (est.canal_notificacion ?? "AMBOS") === "IN_APP" || correosEnviados.has(est.correo)) continue;
    correosEnviados.add(est.correo);
    const curso = uno<{ titulo?: string }>(i.curso);
    programarCorreo({
      para: est.correo,
      ...correoAvisoCurso({
        nombre: est.nombres || "estudiante",
        curso: curso?.titulo || "tu curso",
        mensaje,
        url: `${publicEnv.NEXT_PUBLIC_SITE_URL}${enlace ?? "/estudiante"}`,
      }),
    });
  }
}

/**
 * HU-21 · RF-11 · Envía recordatorios automáticos 1 hora antes de una sesión
 * y 24 horas antes del cierre de una evaluación pendiente, respetando la
 * preferencia de canal de cada estudiante (AMBOS, CORREO o IN_APP).
 */
export async function enviarRecordatoriosPendientes(ahora = new Date()): Promise<{ sesiones: number; evaluaciones: number }> {
  const db = createAdminClient();
  let sesionesEnviadas = 0;
  let evaluacionesEnviadas = 0;

  const fechaLima = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Lima" }).format(ahora);
  const { data: sesiones } = await db
    .from("sesiones")
    .select("id, curso_id, fecha, hora_inicio, modalidad, curso:cursos(titulo, estado)")
    .eq("fecha", fechaLima)
    .neq("modalidad", "ASINCRONA"); // HU-16 · una clase grabada no «inicia»

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const s of (sesiones ?? []) as any[]) {
    const curso = uno<{ titulo: string; estado: string }>(s.curso);
    if (!curso || curso.estado !== "PUBLICADO") continue;
    const inicioMs = new Date(`${s.fecha}T${String(s.hora_inicio).slice(0, 5)}:00-05:00`).getTime();
    const diffMin = (inicioMs - ahora.getTime()) / 60_000;
    if (diffMin < 0 || diffMin > 75) continue;

    const { data: inscripciones } = await db
      .from("inscripciones")
      .select("estudiante_id, estudiante:perfiles(nombres, correo, estado, canal_notificacion)")
      .eq("curso_id", s.curso_id)
      .eq("estado", "CONFIRMADA");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const ins of (inscripciones ?? []) as any[]) {
      const est = uno<{ nombres: string; correo: string; estado: boolean; canal_notificacion?: string }>(ins.estudiante);
      if (!est || !est.estado) continue;
      const canal = est.canal_notificacion ?? "AMBOS";

      const { error: dup } = await db.from("recordatorios_enviados").insert({
        usuario_id: ins.estudiante_id,
        tipo_evento: "SESION_1H",
        referencia_id: s.id,
      });
      if (dup) continue;

      sesionesEnviadas++;
      if (canal === "AMBOS" || canal === "IN_APP") {
        await notificarUsuario(
          ins.estudiante_id,
          `Recordatorio: tu sesión de «${curso.titulo}» inicia a las ${formatearHora(s.hora_inicio)}`,
          "/estudiante",
        );
      }
      if ((canal === "AMBOS" || canal === "CORREO") && est.correo) {
        programarCorreo({
          para: est.correo,
          ...correoRecordatorioSesion({
            nombre: est.nombres || "estudiante",
            curso: curso.titulo,
            fecha: formatearFecha(s.fecha),
            hora: formatearHora(s.hora_inicio),
            modalidad: ETIQUETA_TIPO_SESION[(s.modalidad as TipoSesion) ?? "VIRTUAL"],
            url: `${publicEnv.NEXT_PUBLIC_SITE_URL}/estudiante`,
          }),
        });
      }
    }
  }

  const limite24h = new Date(ahora.getTime() + 24 * 3600_000).toISOString();
  const { data: evaluaciones } = await db
    .from("evaluaciones")
    .select("id, curso_id, titulo, fecha_limite, curso:cursos(titulo, estado)")
    .gte("fecha_limite", ahora.toISOString())
    .lte("fecha_limite", limite24h);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const ev of (evaluaciones ?? []) as any[]) {
    const curso = uno<{ titulo: string; estado: string }>(ev.curso);
    if (!curso || curso.estado !== "PUBLICADO" || !ev.fecha_limite) continue;

    const { data: inscripciones } = await db
      .from("inscripciones")
      .select("id, estudiante_id, estudiante:perfiles(nombres, correo, estado, canal_notificacion), intentos_evaluacion(evaluacion_id)")
      .eq("curso_id", ev.curso_id)
      .eq("estado", "CONFIRMADA");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const ins of (inscripciones ?? []) as any[]) {
      const yaRindio = ((ins.intentos_evaluacion ?? []) as { evaluacion_id: number }[]).some((ie) => ie.evaluacion_id === ev.id);
      if (yaRindio) continue;
      const est = uno<{ nombres: string; correo: string; estado: boolean; canal_notificacion?: string }>(ins.estudiante);
      if (!est || !est.estado) continue;
      const canal = est.canal_notificacion ?? "AMBOS";

      const { error: dup } = await db.from("recordatorios_enviados").insert({
        usuario_id: ins.estudiante_id,
        tipo_evento: "EVALUACION_24H",
        referencia_id: ev.id,
      });
      if (dup) continue;

      evaluacionesEnviadas++;
      if (canal === "AMBOS" || canal === "IN_APP") {
        await notificarUsuario(
          ins.estudiante_id,
          `Recordatorio: la evaluación «${ev.titulo}» (${curso.titulo}) vence en menos de 24 h`,
          `/estudiante/evaluaciones/${ev.id}`,
        );
      }
      if ((canal === "AMBOS" || canal === "CORREO") && est.correo) {
        programarCorreo({
          para: est.correo,
          ...correoRecordatorioEvaluacion({
            nombre: est.nombres || "estudiante",
            curso: curso.titulo,
            evaluacion: ev.titulo,
            venceEn: formatearFechaHora(ev.fecha_limite),
            url: `${publicEnv.NEXT_PUBLIC_SITE_URL}/estudiante/evaluaciones/${ev.id}`,
          }),
        });
      }
    }
  }

  return { sesiones: sesionesEnviadas, evaluaciones: evaluacionesEnviadas };
}
