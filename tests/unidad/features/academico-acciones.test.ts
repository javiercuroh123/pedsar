import { describe, expect, it, vi } from "vitest";
import { iniciarEvaluacion, enviarEvaluacion, marcarCompletado, solicitarReembolso } from "@/features/academico/acciones-estudiante";
import {
  crearContenido,
  crearEvaluacion,
  crearModulo,
  crearSesion,
  eliminarContenido,
  eliminarEvaluacion,
  eliminarModulo,
  eliminarSesion,
  guardarAsistencia,
  type NuevaEvaluacion,
} from "@/features/academico/acciones-instructor";
import { requireRol } from "@/lib/auth";
import { conSesion, entorno, formulario, Redireccion, responder, UUID } from "../../apoyo/entorno";

vi.mock("@/lib/auth", () => import("../../apoyo/auth-falso"));

describe("progreso protegido", () => {
  const marcar = () => marcarCompletado(formulario({ inscripcionId: UUID.inscripcion, contenidoId: "12", cursoId: UUID.otra }));
  it("deduce el curso de la matrícula confirmada e ignora el curso adulterado", async () => {
    conSesion("estudiante");
    responder({ "inscripciones.select": { data: { id: UUID.inscripcion, curso_id: UUID.curso } } });
    await marcar();
    expect(entorno.servidor.de("inscripciones")[0].filtros).toContainEqual(["eq", "estado", "CONFIRMADA"]);
    expect(entorno.servidor.de("contenidos_completados", "insert")[0].valores).toEqual({ inscripcion_id: UUID.inscripcion, contenido_id: 12 });
    expect(entorno.admin.consultas).toHaveLength(0);
  });
  it("no escribe si no hay matrícula propia confirmada", async () => {
    conSesion("estudiante");
    await expect(marcar()).rejects.toThrow("matrícula confirmada");
    expect(entorno.servidor.de("contenidos_completados")).toHaveLength(0);
  });
  it("tolera una repetición pero propaga el rechazo de contenido ajeno", async () => {
    conSesion("estudiante");
    responder({ inscripciones: { data: { id: UUID.inscripcion, curso_id: UUID.curso } }, "contenidos_completados.insert": [{ error: { code: "23505", message: "dup" } }, { error: { code: "42501", message: "RLS" } }] });
    await marcar();
    await expect(marcar()).rejects.toThrow("No se pudo completar");
  });
});

describe("intentos de evaluación controlados en servidor", () => {
  it("inicia el plazo antes de devolver preguntas y nunca selecciona la respuesta correcta", async () => {
    conSesion("estudiante");
    responder({}, { "rpc:iniciar_evaluacion": { data: { numero_intento: 1, vence_en: "2026-11-10T16:00:00Z", servidor_en: "2026-11-10T15:00:00Z" } }, preguntas: { data: [{ id: 1, enunciado: "Capital", opciones: ["Lima", "Cusco"], puntaje: 20 }] } });
    await expect(iniciarEvaluacion(5)).resolves.toMatchObject({ ok: true, sesion: { numero_intento: 1 } });
    expect(entorno.admin.consultas[0].tabla).toBe("rpc:iniciar_evaluacion");
    expect(entorno.admin.de("preguntas")[0].columnas).not.toContain("respuesta_correcta");
  });
  it("no revela preguntas si la BD rechaza el inicio", async () => {
    conSesion("estudiante");
    responder({}, { "rpc:iniciar_evaluacion": { error: { message: "Ya usaste todos tus intentos" } } });
    await expect(iniciarEvaluacion(5)).resolves.toMatchObject({ ok: false });
    expect(entorno.admin.de("preguntas")).toHaveLength(0);
  });
  it("entrega respuestas e identidad autenticada a la operación atómica", async () => {
    conSesion("estudiante");
    responder({}, { "rpc:entregar_evaluacion": { data: { puntaje: 15, total: 20, correctas: 2, preguntas: 3, intentos_restantes: 1, fuera_de_plazo: false } } });
    await expect(enviarEvaluacion(5, { 1: "Lima" }, 1)).resolves.toEqual({ ok: true, puntaje: 15, total: 20, correctas: 2, preguntas: 3, aprobado: true, intentosRestantes: 1 });
    expect(entorno.admin.de("rpc:entregar_evaluacion")[0].valores).toEqual({ p_estudiante: UUID.estudiante, p_evaluacion: 5, p_intento: 1, p_respuestas: { 1: "Lima" } });
    expect(entorno.admin.de("intentos_evaluacion", "insert")).toHaveLength(0);
  });
  it("informa el intento vencido sin afirmar que aprobó", async () => {
    conSesion("estudiante");
    responder({}, { "rpc:entregar_evaluacion": { data: { puntaje: 0, total: 20, correctas: 0, preguntas: 3, intentos_restantes: 0, fuera_de_plazo: true } } });
    await expect(enviarEvaluacion(5, { 1: "Lima" }, 1)).resolves.toMatchObject({ ok: true, aprobado: false, mensaje: expect.stringContaining("plazo venció") });
  });
  it("no registra éxito cuando falla la transacción", async () => {
    conSesion("estudiante");
    responder({}, { "rpc:entregar_evaluacion": { error: { message: "Inicia la evaluación antes de entregar" } } });
    await expect(enviarEvaluacion(5, {}, 1)).resolves.toMatchObject({ ok: false });
    expect(entorno.admin.de("registro_actividad")).toHaveLength(0);
    await expect(enviarEvaluacion(5, {}, 0)).rejects.toThrow();
  });
});

describe("solicitud de reembolso (HU-31)", () => {
  const solicitar = (motivo = "No podré asistir por viaje de trabajo") => solicitarReembolso({}, formulario({ pagoId: UUID.pago, motivo }));

  it("solo para pagos aprobados y una vez por pago", async () => {
    conSesion("estudiante");
    await expect(solicitar("corto")).resolves.toEqual({ ok: false, mensaje: "Describe el motivo (mínimo 10 caracteres)" });
    responder({ pagos: { data: { id: UUID.pago, monto: 180, estado: "PENDIENTE" } } });
    await expect(solicitar()).resolves.toEqual({ ok: false, mensaje: "Solo se pueden reembolsar pagos aprobados" });
    responder({ pagos: { data: { id: UUID.pago, monto: 180, estado: "APROBADO" } }, "reembolsos.select": { data: { id: 1 } } });
    await expect(solicitar()).resolves.toEqual({ ok: false, mensaje: "Ya existe una solicitud de reembolso para este pago" });
    responder({ pagos: { data: { id: UUID.pago, monto: 180, estado: "APROBADO" } }, "reembolsos.insert": { error: { message: "RLS" } } });
    await expect(solicitar()).resolves.toEqual({ ok: false, mensaje: "RLS" });
  });

  it("registra la solicitud por el monto pagado", async () => {
    conSesion("estudiante");
    responder({ pagos: { data: { id: UUID.pago, monto: 180, estado: "APROBADO" } } });
    await expect(solicitar()).resolves.toEqual({ ok: true, mensaje: "Solicitud enviada. Te responderemos por correo." });
    expect(entorno.servidor.de("reembolsos", "insert")[0].valores).toEqual({ pago_id: UUID.pago, motivo: "No podré asistir por viaje de trabajo", monto: 180 });
    expect(entorno.admin.de("registro_actividad")[0].valores).toMatchObject({ accion: "SOLICITAR_REEMBOLSO" });
  });
});

describe("portal del instructor", () => {
  it("solo instructores y administradores", async () => {
    conSesion("estudiante");
    await expect(eliminarModulo(formulario({ id: "1" }))).rejects.toEqual(new Redireccion("/estudiante"));
    expect(requireRol).toHaveBeenCalledWith("instructor", "administrador");
  });

  it("agrega módulos y contenidos al final; RLS impide editar cursos ajenos", async () => {
    conSesion("instructor");
    responder({ "modulos.select": { count: 2 }, "modulos.insert": [{}, { error: { message: "RLS" } }], "contenidos.select": { count: null }, "contenidos.insert": [{}, { error: { message: "x" } }] });
    await expect(crearModulo({}, formulario({ cursoId: UUID.curso, titulo: "Tablas dinámicas" }))).resolves.toEqual({ ok: true, mensaje: "Módulo agregado" });
    expect(entorno.servidor.de("modulos", "insert")[0].valores).toEqual({ curso_id: UUID.curso, titulo: "Tablas dinámicas", orden: 3 });
    await expect(crearModulo({}, formulario({ cursoId: UUID.curso, titulo: "Ajeno" }))).resolves.toEqual({ ok: false, mensaje: "No tienes permiso para editar este curso" });
    await expect(crearModulo({}, formulario({ cursoId: UUID.curso, titulo: "a" }))).resolves.toEqual({ ok: false, mensaje: "Escribe el título del módulo" });

    const contenido = { moduloId: "3", titulo: "Guía de fórmulas", tipo: "PDF", url: `${UUID.curso}/guia.pdf` };
    await expect(crearContenido({}, formulario(contenido))).resolves.toEqual({ ok: true, mensaje: "Contenido publicado en el aula" });
    expect(entorno.servidor.de("contenidos", "insert")[0].valores).toEqual({ modulo_id: 3, titulo: "Guía de fórmulas", tipo: "PDF", url_archivo: `${UUID.curso}/guia.pdf`, orden: 1 });
    await expect(crearContenido({}, formulario(contenido))).resolves.toEqual({ ok: false, mensaje: "No se pudo guardar el contenido" });
    await expect(crearContenido({}, formulario({ ...contenido, tipo: "ENLACE", url: "javascript:alert(1)" }))).resolves.toEqual({ ok: false, mensaje: "La URL debe empezar con https://" });
    await expect(crearContenido({}, formulario({ ...contenido, url: "" }))).resolves.toEqual({ ok: false, mensaje: "Adjunta un archivo o escribe la URL" });

    await eliminarModulo(formulario({ id: "3" }));
    await eliminarContenido(formulario({ id: "8" }));
    await eliminarSesion(formulario({ id: "4" }));
    await eliminarEvaluacion(formulario({ id: "5" }));
    expect(["modulos", "contenidos", "sesiones", "evaluaciones"].map((t) => entorno.servidor.de(t, "delete")[0].filtros[0])).toEqual([
      ["eq", "id", 3],
      ["eq", "id", 8],
      ["eq", "id", 4],
      ["eq", "id", 5],
    ]);
  });

  it("programa sesiones (HU-16)", async () => {
    conSesion("instructor");
    responder({ "sesiones.insert": [{}, { error: { message: "RLS" } }] });
    const sesion = { cursoId: UUID.curso, fecha: "2026-10-10", horaInicio: "19:00", duracion: "90", modalidad: "VIRTUAL", enlace: "" };
    await expect(crearSesion({}, formulario(sesion))).resolves.toEqual({ ok: true, mensaje: "Sesión programada" });
    expect(entorno.servidor.de("sesiones", "insert")[0].valores).toEqual({ curso_id: UUID.curso, fecha: "2026-10-10", hora_inicio: "19:00", duracion_minutos: 90, modalidad: "VIRTUAL", enlace_virtual: null });
    await expect(crearSesion({}, formulario(sesion))).resolves.toEqual({ ok: false, mensaje: "No se pudo programar la sesión" });
    await expect(crearSesion({}, formulario({ ...sesion, enlace: "zoom" }))).resolves.toEqual({ ok: false, mensaje: "El enlace debe ser una URL válida" });
  });

  it("registra asistencia solo de inscripciones confirmadas del curso (HU-58)", async () => {
    conSesion("instructor");
    const ajena = "99999999-9999-4999-8999-999999999999";
    const asistencia = formulario({ sesionId: "4", fecha: "2026-10-10", [`a:${UUID.inscripcion}`]: "PRESENTE", [`a:${UUID.otra}`]: "TARDANZA", [`a:${ajena}`]: "AUSENTE" });
    responder({ "sesiones.select": { data: { curso_id: UUID.curso } }, "inscripciones.select": { data: [{ id: UUID.inscripcion }, { id: UUID.otra }] } });
    await expect(guardarAsistencia({}, asistencia)).resolves.toEqual({ ok: true, mensaje: "Asistencia guardada correctamente" });
    const guardado = entorno.servidor.de("asistencias", "upsert")[0];
    expect(guardado.opciones).toEqual({ onConflict: "inscripcion_id,sesion_id" });
    expect((guardado.valores as { inscripcion_id: string; estado: string }[]).map((f) => [f.inscripcion_id, f.estado])).toEqual([
      [UUID.inscripcion, "PRESENTE"],
      [UUID.otra, "TARDANZA"],
    ]);

    await expect(guardarAsistencia({}, formulario({ sesionId: "4", fecha: "2026-10-10" }))).resolves.toEqual({ ok: false, mensaje: "No hay estudiantes para registrar" });
    responder();
    await expect(guardarAsistencia({}, asistencia)).resolves.toEqual({ ok: false, mensaje: "Sesión no encontrada" });
    responder({ "sesiones.select": { data: { curso_id: UUID.curso } }, asistencias: { error: { message: "RLS" } } });
    await expect(guardarAsistencia({}, asistencia)).resolves.toEqual({ ok: false, mensaje: "No se pudo guardar la asistencia" });
  });

  describe("constructor de evaluaciones (HU-59)", () => {
    const nueva = (extra: Partial<NuevaEvaluacion> = {}): NuevaEvaluacion => ({
      cursoId: UUID.curso,
      titulo: "Examen final",
      puntajeTotal: 20,
      intentos: 2,
      tiempo: 0,
      preguntas: [{ enunciado: "¿Capital del Perú?", opciones: ["Cusco", "Lima"], correcta: 1, puntaje: 2 }],
      ...extra,
    });

    it("guarda la evaluación y la respuesta correcta como texto de la opción", async () => {
      conSesion("instructor");
      responder({ "evaluaciones.insert": { data: { id: 5 } } });
      await expect(crearEvaluacion(nueva())).resolves.toEqual({ ok: true, mensaje: "Evaluación publicada" });
      expect(entorno.servidor.de("evaluaciones", "insert")[0].valores).toEqual({ curso_id: UUID.curso, titulo: "Examen final", puntaje_total: 20, intentos_permitidos: 2, tiempo_limite_min: null });
      expect(entorno.servidor.de("preguntas", "insert")[0].valores).toEqual([{ evaluacion_id: 5, enunciado: "¿Capital del Perú?", opciones: ["Cusco", "Lima"], respuesta_correcta: "Lima", puntaje: 2 }]);
    });

    it("valida, informa permisos y deshace la evaluación si fallan las preguntas", async () => {
      conSesion("instructor");
      await expect(crearEvaluacion(nueva({ preguntas: [] }))).resolves.toEqual({ ok: false, mensaje: "Agrega al menos una pregunta" });
      responder({ "evaluaciones.insert": { error: { message: "RLS" } } });
      await expect(crearEvaluacion(nueva())).resolves.toEqual({ ok: false, mensaje: "No tienes permiso para crear evaluaciones en este curso" });
      responder({ "evaluaciones.insert": { data: { id: 5 } }, preguntas: { error: { message: "x" } } });
      await expect(crearEvaluacion(nueva({ preguntas: [{ enunciado: "¿Opción?", opciones: ["A", "B"], correcta: 7, puntaje: 1 }] }))).resolves.toEqual({
        ok: false,
        mensaje: "No se pudieron guardar las preguntas",
      });
      expect((entorno.servidor.de("preguntas")[0].valores as { respuesta_correcta: string }[])[0].respuesta_correcta).toBe("A");
      expect(entorno.servidor.de("evaluaciones", "delete")[0].filtros).toEqual([["eq", "id", 5]]);
    });
  });
});
