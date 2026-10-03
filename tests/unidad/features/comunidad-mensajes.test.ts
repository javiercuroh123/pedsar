import { describe, expect, it, vi } from "vitest";
import { listarBandejaInstructor, listarConversacionesEstudiante, obtenerConversacion } from "@/features/comunidad/consultas";
import { enviarMensaje, marcarLeidos } from "@/features/comunidad/mensajes";
import { programarCorreo } from "@/lib/email";
import { correoMensajeNuevo } from "@/lib/email/plantillas";
import { conSesion, entorno, formulario, responder, UUID } from "../../apoyo/entorno";

vi.mock("@/lib/auth", () => import("../../apoyo/auth-falso"));
vi.mock("@/lib/email", () => ({ programarCorreo: vi.fn() }));

const INSCRITA = { data: { id: UUID.inscripcion, curso: { id: UUID.curso, titulo: "Excel", instructor_id: UUID.instructor } } };
const CONVERSACION = { data: { id: 5, curso_id: UUID.curso, estudiante_id: UUID.estudiante, curso: { titulo: "Excel", instructor_id: UUID.instructor } } };
const DESTINATARIO = { data: { nombres: "Luis", correo: "luis@pedsar.test" } };
const notificaciones = () => entorno.admin.de("notificaciones").map((c) => c.valores as { usuario_id: string; mensaje: string; enlace: string });

describe("enviar un mensaje (HU-19)", () => {
  it("el primer mensaje del estudiante abre la conversación, avisa al instructor y le envía un correo", async () => {
    conSesion("estudiante", { nombres: "Ana" });
    responder(
      { inscripciones: INSCRITA, "conversaciones.select": { data: null }, "conversaciones.insert": { data: { id: 5 } }, "mensajes.select": { count: 0 } },
      { perfiles: DESTINATARIO },
    );
    await expect(enviarMensaje({}, formulario({ cursoId: UUID.curso, texto: "  ¿Hasta cuándo es la entrega?  " }))).resolves.toEqual({ ok: true });

    expect(entorno.servidor.de("inscripciones")[0].filtros).toEqual(
      expect.arrayContaining([["eq", "curso_id", UUID.curso], ["eq", "estudiante_id", UUID.estudiante], ["eq", "estado", "CONFIRMADA"]]),
    );
    expect(entorno.servidor.de("conversaciones", "insert")[0].valores).toEqual({ curso_id: UUID.curso, estudiante_id: UUID.estudiante });
    expect(entorno.servidor.de("mensajes", "insert")[0].valores).toEqual({ conversacion_id: 5, autor_id: UUID.estudiante, texto: "¿Hasta cuándo es la entrega?" });
    expect(notificaciones()[0]).toMatchObject({ usuario_id: UUID.instructor, enlace: "/instructor/mensajes/5", mensaje: expect.stringContaining("Ana") });
    expect(programarCorreo).toHaveBeenCalledTimes(1);
    expect(vi.mocked(programarCorreo).mock.calls[0][0]).toMatchObject({ para: "luis@pedsar.test", asunto: expect.stringContaining("Nuevo mensaje") });
  });

  it("si ya existe la conversación (aunque se haya reinscrito), la reutiliza", async () => {
    conSesion("estudiante");
    responder({ inscripciones: INSCRITA, "conversaciones.select": { data: { id: 5 } }, "mensajes.select": { count: 0 } }, { perfiles: DESTINATARIO });
    await enviarMensaje({}, formulario({ cursoId: UUID.curso, texto: "Hola" }));
    expect(entorno.servidor.de("conversaciones", "insert")).toHaveLength(0);
    expect(entorno.servidor.de("mensajes", "insert")[0].valores).toMatchObject({ conversacion_id: 5 });
  });

  it("si el destinatario aún no leyó un mensaje anterior, avisa en la campana pero no envía otro correo", async () => {
    conSesion("estudiante");
    responder({ inscripciones: INSCRITA, "conversaciones.select": { data: { id: 5 } }, "mensajes.select": { count: 1 } }, { perfiles: DESTINATARIO });
    await enviarMensaje({}, formulario({ cursoId: UUID.curso, texto: "¿Me leyó?" }));
    expect(entorno.servidor.de("mensajes", "select")[0].filtros).toEqual(
      expect.arrayContaining([["eq", "conversacion_id", 5], ["eq", "autor_id", UUID.estudiante], ["is", "leido_en", null]]),
    );
    expect(notificaciones()).toHaveLength(1);
    expect(programarCorreo).not.toHaveBeenCalled();
  });

  it("el instructor responde en una conversación existente y el aviso lleva al estudiante a su chat del curso", async () => {
    conSesion("instructor", { nombres: "Luis" });
    responder({ conversaciones: CONVERSACION, "mensajes.select": { count: 0 } }, { perfiles: { data: { nombres: "Ana", correo: "ana@pedsar.test" } } });
    await expect(enviarMensaje({}, formulario({ conversacionId: "5", texto: "El viernes a las 23:59" }))).resolves.toEqual({ ok: true });
    expect(entorno.servidor.de("mensajes", "insert")[0].valores).toEqual({ conversacion_id: 5, autor_id: UUID.instructor, texto: "El viernes a las 23:59" });
    expect(notificaciones()[0]).toMatchObject({ usuario_id: UUID.estudiante, enlace: `/estudiante/mensajes/${UUID.curso}` });
  });

  it("el instructor no abre conversaciones nuevas ni escribe en las ajenas", async () => {
    conSesion("instructor");
    await expect(enviarMensaje({}, formulario({ cursoId: UUID.curso, texto: "Hola" }))).resolves.toEqual({ ok: false, mensaje: "Responde desde una conversación existente" });
    responder({ conversaciones: { data: null } });
    await expect(enviarMensaje({}, formulario({ conversacionId: "9", texto: "Hola" }))).resolves.toEqual({ ok: false, mensaje: "No encontramos esa conversación" });
    expect(entorno.servidor.de("mensajes")).toHaveLength(0);
  });

  it.each([
    ["vacío", "   ", "Escribe tu mensaje"],
    ["demasiado largo", "x".repeat(2001), "El mensaje no puede pasar de 2000 caracteres"],
  ])("rechaza un mensaje %s sin consultar la BD", async (_, texto, mensaje) => {
    conSesion("estudiante");
    await expect(enviarMensaje({}, formulario({ cursoId: UUID.curso, texto }))).resolves.toEqual({ ok: false, mensaje });
    expect(entorno.servidor.consultas).toHaveLength(0);
  });

  it("sin matrícula confirmada o sin instructor asignado, lo explica", async () => {
    conSesion("estudiante");
    responder({ inscripciones: { data: null } });
    await expect(enviarMensaje({}, formulario({ cursoId: UUID.curso, texto: "Hola" }))).resolves.toEqual({
      ok: false,
      mensaje: "Solo puedes escribir en cursos en los que estás matriculado",
    });
    responder({ inscripciones: { data: { id: UUID.inscripcion, curso: { id: UUID.curso, titulo: "Excel", instructor_id: null } } } });
    await expect(enviarMensaje({}, formulario({ cursoId: UUID.curso, texto: "Hola" }))).resolves.toEqual({ ok: false, mensaje: "Este curso aún no tiene instructor asignado" });
    expect(entorno.servidor.de("mensajes")).toHaveLength(0);
  });

  it("si la BD rechaza el mensaje, lo informa", async () => {
    conSesion("estudiante");
    responder({ inscripciones: INSCRITA, "conversaciones.select": { data: { id: 5 } }, "mensajes.select": { count: 0 }, "mensajes.insert": { error: { code: "42501", message: "RLS" } } });
    await expect(enviarMensaje({}, formulario({ cursoId: UUID.curso, texto: "Hola" }))).resolves.toEqual({ ok: false, mensaje: "No se pudo enviar el mensaje" });
    expect(notificaciones()).toHaveLength(0);
  });
});

describe("leer conversaciones", () => {
  it("marcar como leídos usa la función segura de la BD", async () => {
    conSesion("estudiante");
    await marcarLeidos(5);
    expect(entorno.servidor.de("rpc:marcar_leidos")[0].valores).toEqual({ p_conversacion: 5 });
  });

  it("el estudiante ve un chat por curso confirmado, con el instructor y los no leídos", async () => {
    conSesion("estudiante");
    responder(
      {
        inscripciones: { data: [{ curso: { id: UUID.curso, titulo: "Excel", instructor_id: UUID.instructor } }, { curso: { id: UUID.otra, titulo: "Redes", instructor_id: null } }] },
        conversaciones: { data: [{ id: 5, curso_id: UUID.curso, ultimo_mensaje_en: "2026-10-02T15:00:00Z", mensajes: [{ texto: "El viernes", enviado_en: "2026-10-02T15:00:00Z" }] }] },
        mensajes: { data: [{ conversacion_id: 5, autor_id: UUID.instructor }, { conversacion_id: 5, autor_id: UUID.otra }, { conversacion_id: 5, autor_id: UUID.estudiante }] },
        "rpc:instructores_publicos": { data: [{ id: UUID.instructor, nombres: "Luis", apellidos: "Ramos" }] },
      },
    );
    await expect(listarConversacionesEstudiante(UUID.estudiante)).resolves.toEqual([
      { id: 5, cursoId: UUID.curso, curso: "Excel", otro: "Luis Ramos", ultimoMensaje: "El viernes", ultimoEn: "2026-10-02T15:00:00Z", noLeidos: 2 },
      { id: null, cursoId: UUID.otra, curso: "Redes", otro: "Sin instructor asignado", ultimoMensaje: null, ultimoEn: null, noLeidos: 0 },
    ]);
  });

  it("la bandeja del instructor lista sus conversaciones (filtrables por curso) con los no leídos", async () => {
    conSesion("instructor");
    responder(
      {
        conversaciones: { data: [{ id: 5, curso_id: UUID.curso, estudiante_id: UUID.estudiante, ultimo_mensaje_en: "2026-10-02T15:00:00Z", curso: { titulo: "Excel" }, mensajes: [{ texto: "¿Hasta cuándo?", enviado_en: "2026-10-02T15:00:00Z" }] }] },
        mensajes: { data: [{ conversacion_id: 5, autor_id: UUID.estudiante }, { conversacion_id: 5, autor_id: UUID.otra }] },
      },
      { perfiles: { data: [{ id: UUID.estudiante, nombres: "Ana", apellidos: "Quispe" }] } },
    );
    await expect(listarBandejaInstructor(UUID.curso)).resolves.toEqual([
      { id: 5, cursoId: UUID.curso, curso: "Excel", otro: "Ana Quispe", ultimoMensaje: "¿Hasta cuándo?", ultimoEn: "2026-10-02T15:00:00Z", noLeidos: 1 },
    ]);
    expect(entorno.servidor.de("conversaciones")[0].filtros).toContainEqual(["eq", "curso_id", UUID.curso]);
  });

  it("una conversación trae sus 500 mensajes más recientes en orden cronológico y marca cuáles son propios", async () => {
    conSesion("estudiante");
    responder(
      {
        conversaciones: { data: { id: 5, curso_id: UUID.curso, estudiante_id: UUID.estudiante, curso: { titulo: "Excel", instructor_id: UUID.instructor } } },
        mensajes: { data: [{ id: 2, texto: "Hola, Ana", enviado_en: "2026-10-02T14:05:00Z", autor_id: UUID.instructor, leido_en: "2026-10-02T14:06:00Z" }, { id: 1, texto: "Hola", enviado_en: "2026-10-02T14:00:00Z", autor_id: UUID.estudiante, leido_en: null }] },
        "rpc:instructores_publicos": { data: [{ id: UUID.instructor, nombres: "Luis", apellidos: "Ramos" }] },
      },
    );
    await expect(obtenerConversacion({ cursoId: UUID.curso, estudianteId: UUID.estudiante }, UUID.estudiante)).resolves.toEqual({
      id: 5,
      cursoId: UUID.curso,
      curso: "Excel",
      otro: "Luis Ramos",
      mensajes: [
        { id: 1, texto: "Hola", enviadoEn: "2026-10-02T14:00:00Z", propio: true, leido: false },
        { id: 2, texto: "Hola, Ana", enviadoEn: "2026-10-02T14:05:00Z", propio: false, leido: true },
      ],
    });
    expect(entorno.servidor.de("mensajes")[0].filtros).toEqual(expect.arrayContaining([["eq", "conversacion_id", 5], ["order", "enviado_en", { ascending: false }], ["limit", 500]]));
  });

  it("tras reasignar el curso, los mensajes del instructor anterior siguen del lado del instructor", async () => {
    conSesion("instructor");
    const conversacion = { id: 5, curso_id: UUID.curso, estudiante_id: UUID.estudiante, curso: { titulo: "Excel", instructor_id: UUID.instructor } };
    const mensajes = [
      { id: 2, texto: "Sube el archivo", enviado_en: "2026-10-02T14:05:00Z", autor_id: UUID.otra, leido_en: null },
      { id: 1, texto: "Hola", enviado_en: "2026-10-02T14:00:00Z", autor_id: UUID.estudiante, leido_en: null },
    ];
    responder({ conversaciones: { data: conversacion }, mensajes: { data: mensajes } }, { perfiles: { data: [{ id: UUID.estudiante, nombres: "Ana", apellidos: "Quispe" }] } });
    const comoInstructor = await obtenerConversacion({ id: 5 }, UUID.instructor);
    expect(comoInstructor?.mensajes.map((m) => [m.id, m.propio])).toEqual([[1, false], [2, true]]);

    conSesion("estudiante");
    responder({ conversaciones: { data: conversacion }, mensajes: { data: mensajes }, "rpc:instructores_publicos": { data: [] } });
    const comoEstudiante = await obtenerConversacion({ id: 5 }, UUID.estudiante);
    expect(comoEstudiante?.mensajes.map((m) => [m.id, m.propio])).toEqual([[1, true], [2, false]]);
  });

  it("sin acceso a la conversación devuelve null", async () => {
    conSesion("instructor");
    responder({ conversaciones: { data: null } });
    await expect(obtenerConversacion({ id: 9 }, UUID.instructor)).resolves.toBeNull();
  });
});

describe("correo de mensaje nuevo", () => {
  it("escapa el texto y recorta el extracto", () => {
    const { asunto, html } = correoMensajeNuevo({ nombre: "Luis", de: "Ana <script>", curso: "Excel", extracto: "y".repeat(200), url: "https://pedsar.test/x" });
    expect(asunto).toBe("Nuevo mensaje de Ana <script> · Excel");
    expect(html).toContain("Ana &lt;script&gt;");
    expect(html).toContain(`${"y".repeat(140)}…`);
    expect(html).not.toContain("y".repeat(141));
  });
});
