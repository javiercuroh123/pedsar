import "server-only";
import { evaluarAptitud, type ResultadoAcademico } from "@/config/academico";
import { uno } from "@/features/academico/consultas";
import { enlaceEncuestaDe } from "@/features/encuestas/enlace";
import { notificarUsuario } from "@/features/notificaciones/enviar";
import { registrarActividad } from "@/lib/auditoria";
import { generarCodigoCertificado } from "@/lib/certificados";
import { programarCorreo } from "@/lib/email";
import { correoCertificadoEmitido } from "@/lib/email/plantillas";
import { publicEnv } from "@/lib/env";
import { nombreCompleto } from "@/lib/formato";
import { createAdminClient } from "@/lib/supabase/admin";

const numeroONull = (v: unknown) => (v === null || v === undefined ? null : Number(v));

/**
 * HU-11 · RF-08 · Emisión automática de certificados digitales cuando el
 * estudiante cumple los criterios de aprobación (nota final >= 13/20 con todas
 * las evaluaciones rendidas y asistencia >= 75 % de las sesiones del curso).
 */
export async function emitirCertificadosAutomaticos(inscripcionIds: string[], actorId: string): Promise<number> {
  if (!inscripcionIds.length) return 0;
  const admin = createAdminClient();
  const { data: resultados } = await admin.rpc("resultado_academico", { p_inscripciones: inscripcionIds });
  if (!resultados?.length) return 0;

  const mapaResultados = new Map<string, ResultadoAcademico>();
  for (const r of resultados) {
    const normalizado: ResultadoAcademico = {
      ...r,
      nota_final: numeroONull(r.nota_final),
      asistencia: numeroONull(r.asistencia),
      progreso: numeroONull(r.progreso),
    };
    if (evaluarAptitud(normalizado).apto) {
      mapaResultados.set(r.inscripcion_id, normalizado);
    }
  }

  if (!mapaResultados.size) return 0;

  const { data: inscripciones } = await admin
    .from("inscripciones")
    .select(
      "id, estudiante_id, estudiante:perfiles(nombres, apellidos, correo), curso:cursos(titulo, duracion_horas, instructor:perfiles(nombres, apellidos)), certificados(id)",
    )
    .in("id", [...mapaResultados.keys()])
    .eq("estado", "CONFIRMADA");

  if (!inscripciones?.length) return 0;

  let emitidos = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const i of inscripciones as any[]) {
    if (uno(i.certificados)) continue;
    const res = mapaResultados.get(i.id);
    if (!res) continue;

    const est = uno<{ nombres: string; apellidos: string; correo: string }>(i.estudiante);
    const cur = uno<{ titulo: string; duracion_horas: number; instructor: unknown }>(i.curso);
    const ins = cur ? uno<{ nombres: string; apellidos: string }>(cur.instructor) : null;
    const codigo = generarCodigoCertificado();

    const { error } = await admin.from("certificados").insert({
      inscripcion_id: i.id,
      codigo_unico: codigo,
      estudiante_nombre: est ? nombreCompleto(est) || est.correo : null,
      curso_titulo: cur?.titulo ?? null,
      duracion_horas: cur?.duracion_horas ?? null,
      instructor_nombre: ins ? nombreCompleto(ins) || null : null,
      nota_final: res.nota_final,
      asistencia: res.asistencia,
      motivo_excepcion: null,
    });
    if (error) continue;

    emitidos++;
    const titulo = cur?.titulo ?? "tu curso";
    await registrarActividad(actorId, "EMITIR_CERTIFICADO", {
      inscripcion: i.id,
      codigo,
      nota_final: res.nota_final,
      asistencia: res.asistencia,
      automatico: true,
    });
    await notificarUsuario(
      i.estudiante_id,
      `¡Felicitaciones! Tu certificado de «${titulo}» (${codigo}) está listo para descargar.`,
      `/estudiante/certificados/${codigo}`,
    );
    if (est?.correo) {
      programarCorreo({
        para: est.correo,
        ...correoCertificadoEmitido({
          nombre: est.nombres || "estudiante",
          curso: titulo,
          codigo,
          url: `${publicEnv.NEXT_PUBLIC_SITE_URL}/verificar?codigo=${codigo}`,
          // HU-43 · El trigger de la BD ya envió la encuesta al insertar el certificado.
          encuestaUrl: await enlaceEncuestaDe(i.id),
        }),
      });
    }
  }

  return emitidos;
}

/** Verifica y emite el certificado del estudiante tras aprobar una evaluación del curso. */
export async function emitirCertificadoTrasEvaluacion(estudianteId: string, evaluacionId: number): Promise<number> {
  const admin = createAdminClient();
  const { data: evaluacion } = await admin.from("evaluaciones").select("curso_id").eq("id", evaluacionId).maybeSingle();
  if (!evaluacion?.curso_id) return 0;

  const { data: inscripcion } = await admin
    .from("inscripciones")
    .select("id")
    .eq("estudiante_id", estudianteId)
    .eq("curso_id", evaluacion.curso_id)
    .eq("estado", "CONFIRMADA")
    .maybeSingle();
  if (!inscripcion?.id) return 0;

  return emitirCertificadosAutomaticos([inscripcion.id], estudianteId);
}
