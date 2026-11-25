import "server-only";
import { uno } from "@/features/academico/consultas";
import { enviarCorreo, programarCorreo, type Correo } from "@/lib/email";
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

type MarcaRecordatorio = {
  usuario_id: string;
  tipo_evento: "SESION_1H_CORREO" | "EVALUACION_24H_CORREO";
  referencia_id: number;
};

/**
 * Envía un recordatorio por correo una sola vez: primero registra la marca
 * (única por usuario, tipo y referencia) y, si el envío falla, la borra para
 * que la siguiente vuelta del cron lo reintente.
 */
async function enviarUnaVez(
  db: ReturnType<typeof createAdminClient>,
  marca: MarcaRecordatorio,
  correo: Correo,
): Promise<"enviado" | "repetido" | "fallido"> {
  const { error } = await db.from("recordatorios_enviados").insert(marca);
  if (error) return "repetido";
  try {
    await enviarCorreo(correo);
    return "enviado";
  } catch (e) {
    console.error(`No se pudo enviar el recordatorio «${correo.asunto}»:`, (e as Error).message);
    await db.from("recordatorios_enviados").delete().match(marca);
    return "fallido";
  }
}

/** Quien eligió solo avisos en la plataforma no recibe correos. */
const recibeCorreo = (canal?: string | null) => (canal ?? "AMBOS") !== "IN_APP";

/**
 * HU-21 · HU-40 · RF-11 · Recordatorios por correo: 1 hora antes de una sesión en
 * vivo y 24 horas antes del cierre de una evaluación pendiente. La llama
 * /api/cron/recordatorios, que pg_cron invoca cada 15 minutos.
 *
 * Los avisos de la campana los crea aparte privado.generar_recordatorios_programados()
 * en la base. Por eso aquí se usan marcas propias (SESION_1H_CORREO y
 * EVALUACION_24H_CORREO): así un aviso in-app ya registrado no bloquea el correo.
 */
export async function enviarRecordatoriosPendientes(
  ahora = new Date(),
): Promise<{ sesiones: number; evaluaciones: number; fallidos: number }> {
  const db = createAdminClient();
  const cuenta = { sesiones: 0, evaluaciones: 0, fallidos: 0 };

  // Hoy y mañana en Lima: una sesión a las 00:30 entra en la ventana desde las 23:15 del día anterior.
  const fechaLima = (d: Date) => new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Lima" }).format(d);
  const dias = [...new Set([fechaLima(ahora), fechaLima(new Date(ahora.getTime() + 75 * 60_000))])];
  const { data: sesiones } = await db
    .from("sesiones")
    .select("id, curso_id, fecha, hora_inicio, modalidad, curso:cursos(titulo, estado)")
    .in("fecha", dias)
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
      if (!est?.estado || !est.correo || !recibeCorreo(est.canal_notificacion)) continue;

      const r = await enviarUnaVez(
        db,
        { usuario_id: ins.estudiante_id, tipo_evento: "SESION_1H_CORREO", referencia_id: s.id },
        {
          para: est.correo,
          ...correoRecordatorioSesion({
            nombre: est.nombres || "estudiante",
            curso: curso.titulo,
            fecha: formatearFecha(s.fecha),
            hora: formatearHora(s.hora_inicio),
            modalidad: ETIQUETA_TIPO_SESION[(s.modalidad as TipoSesion) ?? "VIRTUAL"],
            url: `${publicEnv.NEXT_PUBLIC_SITE_URL}/estudiante`,
          }),
        },
      );
      if (r === "enviado") cuenta.sesiones++;
      else if (r === "fallido") cuenta.fallidos++;
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
      if (!est?.estado || !est.correo || !recibeCorreo(est.canal_notificacion)) continue;

      const r = await enviarUnaVez(
        db,
        { usuario_id: ins.estudiante_id, tipo_evento: "EVALUACION_24H_CORREO", referencia_id: ev.id },
        {
          para: est.correo,
          ...correoRecordatorioEvaluacion({
            nombre: est.nombres || "estudiante",
            curso: curso.titulo,
            evaluacion: ev.titulo,
            venceEn: formatearFechaHora(ev.fecha_limite),
            url: `${publicEnv.NEXT_PUBLIC_SITE_URL}/estudiante/evaluaciones/${ev.id}`,
          }),
        },
      );
      if (r === "enviado") cuenta.evaluaciones++;
      else if (r === "fallido") cuenta.fallidos++;
    }
  }

  return cuenta;
}
