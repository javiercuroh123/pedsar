import { revalidatePath } from "next/cache";
import { describe, expect, it, vi } from "vitest";
import { listarTemasCurso } from "@/features/comunidad/consultas-foro";
import {
  alternarTemaResuelto,
  crearTemaForo,
  eliminarTemaForo,
  responderTemaForo,
} from "@/features/comunidad/foro";
import { conSesion, entorno, formulario, responder, UUID } from "../../apoyo/entorno";

vi.mock("@/lib/auth", () => import("../../apoyo/auth-falso"));

const notificaciones = () =>
  entorno.admin.de("notificaciones").map((c) => c.valores as { usuario_id: string; mensaje: string; enlace: string });
const auditadas = () =>
  entorno.admin.de("registro_actividad").map((c) => (c.valores as { accion: string }).accion);

describe("foro de discusión y preguntas por lección (HU-22 · HU-23)", () => {
  it("lista los temas del curso con sus respuestas ordenadas, autores e insignia docente", async () => {
    responder({
      foro_temas: { data: [] },
    });
    await expect(listarTemasCurso(UUID.curso, UUID.estudiante)).resolves.toEqual([]);

    responder(
      {
        foro_temas: {
          data: [
            {
              id: 10,
              curso_id: UUID.curso,
              contenido_id: 4,
              autor_id: UUID.estudiante,
              titulo: "Duda sobre tabla dinámica",
              cuerpo: "¿Cómo agrupo por trimestre?",
              resuelto: false,
              creado_en: "2026-10-05T10:00:00Z",
              contenido: { titulo: "Tablas dinámicas" },
              curso: { instructor_id: UUID.instructor },
              foro_respuestas: [
                {
                  id: 2,
                  autor_id: UUID.instructor,
                  texto: "Haz clic derecho en la fecha y elige Agrupar.",
                  creado_en: "2026-10-05T10:15:00Z",
                },
                {
                  id: 1,
                  autor_id: UUID.otra,
                  texto: "Yo también tenía esa duda.",
                  creado_en: "2026-10-05T10:05:00Z",
                },
              ],
            },
          ],
        },
      },
      {
        perfiles: {
          data: [
            { id: UUID.estudiante, nombres: "Ana", apellidos: "Quispe", rol: "estudiante" },
            { id: UUID.instructor, nombres: "Luis", apellidos: "Ramos", rol: "instructor" },
          ],
        },
      },
    );

    const temas = await listarTemasCurso(UUID.curso, UUID.estudiante);
    expect(temas).toEqual([
      {
        id: 10,
        cursoId: UUID.curso,
        contenidoId: 4,
        contenidoTitulo: "Tablas dinámicas",
        titulo: "Duda sobre tabla dinámica",
        cuerpo: "¿Cómo agrupo por trimestre?",
        resuelto: false,
        creadoEn: "2026-10-05T10:00:00Z",
        autorNombre: "Ana Quispe",
        esInstructor: false,
        propio: true,
        puedeResolver: true,
        respuestas: [
          {
            id: 1,
            texto: "Yo también tenía esa duda.",
            creadoEn: "2026-10-05T10:05:00Z",
            autorNombre: "Participante",
            esInstructor: false,
            propio: false,
          },
          {
            id: 2,
            texto: "Haz clic derecho en la fecha y elige Agrupar.",
            creadoEn: "2026-10-05T10:15:00Z",
            autorNombre: "Luis Ramos",
            esInstructor: true,
            propio: false,
          },
        ],
      },
    ]);
  });

  it("publica un tema en el foro general o en una lección y notifica al instructor", async () => {
    conSesion("estudiante");
    responder({
      "foro_temas.insert": { error: null },
      cursos: { data: { titulo: "Excel Avanzado", instructor_id: UUID.instructor } },
    });

    await expect(
      crearTemaForo(
        {},
        formulario({
          cursoId: UUID.curso,
          contenidoId: "4",
          titulo: "  ¿Cómo usar BUSCARX?  ",
          cuerpo: "  Me sale #N/D cuando busco hacia la izquierda.  ",
        }),
      ),
    ).resolves.toEqual({ ok: true, mensaje: "Pregunta publicada en la lección" });

    expect(entorno.servidor.de("foro_temas", "insert")[0].valores).toEqual({
      curso_id: UUID.curso,
      contenido_id: 4,
      autor_id: UUID.estudiante,
      titulo: "¿Cómo usar BUSCARX?",
      cuerpo: "Me sale #N/D cuando busco hacia la izquierda.",
    });
    expect(notificaciones()[0]).toMatchObject({
      usuario_id: UUID.instructor,
      enlace: `/instructor/contenidos?curso=${UUID.curso}`,
    });
    expect(auditadas()).toEqual(["PUBLICAR_TEMA_FORO"]);
    expect(revalidatePath).toHaveBeenCalledWith(`/estudiante/cursos/${UUID.curso}`);
  });

  it("valida los datos al crear un tema y maneja errores de BD", async () => {
    conSesion("instructor");
    await expect(
      crearTemaForo({}, formulario({ cursoId: UUID.curso, titulo: "ab", cuerpo: "ok" })),
    ).resolves.toEqual({ ok: false, mensaje: "Escribe un título más descriptivo" });

    responder({ "foro_temas.insert": { error: { message: "RLS" } } });
    await expect(
      crearTemaForo({}, formulario({ cursoId: UUID.curso, titulo: "Aviso general", cuerpo: "Bienvenidos al curso" })),
    ).resolves.toEqual({ ok: false, mensaje: "No se pudo publicar el tema" });

    responder({
      "foro_temas.insert": { error: null },
      cursos: { data: { titulo: "Excel", instructor_id: UUID.instructor } },
    });
    await expect(
      crearTemaForo({}, formulario({ cursoId: UUID.curso, titulo: "Aviso general", cuerpo: "Bienvenidos al curso" })),
    ).resolves.toEqual({ ok: true, mensaje: "Tema publicado en el foro" });
  });

  it("responde a un tema existente y notifica a su autor cuando responde otra persona", async () => {
    conSesion("instructor");
    await expect(responderTemaForo({}, formulario({ temaId: "10", texto: "x" }))).resolves.toEqual({
      ok: false,
      mensaje: "Escribe tu respuesta",
    });

    responder({ "foro_temas.select": { data: null } });
    await expect(responderTemaForo({}, formulario({ temaId: "10", texto: "Respuesta" }))).resolves.toEqual({
      ok: false,
      mensaje: "No encontramos ese tema",
    });

    responder({
      "foro_temas.select": {
        data: { id: 10, curso_id: UUID.curso, contenido_id: 4, autor_id: UUID.estudiante, titulo: "Duda" },
      },
      "foro_respuestas.insert": { error: { message: "RLS" } },
    });
    await expect(responderTemaForo({}, formulario({ temaId: "10", texto: "Respuesta" }))).resolves.toEqual({
      ok: false,
      mensaje: "No se pudo publicar la respuesta",
    });

    responder({
      "foro_temas.select": {
        data: { id: 10, curso_id: UUID.curso, contenido_id: 4, autor_id: UUID.estudiante, titulo: "Duda" },
      },
      "foro_respuestas.insert": { error: null },
    });
    await expect(
      responderTemaForo({}, formulario({ temaId: "10", texto: "  Revisa el archivo adjunto  " })),
    ).resolves.toEqual({ ok: true, mensaje: "Respuesta publicada" });

    expect(notificaciones()[0]).toMatchObject({
      usuario_id: UUID.estudiante,
      enlace: `/estudiante/cursos/${UUID.curso}?c=4`,
    });
    expect(auditadas()).toEqual(["RESPONDER_TEMA_FORO"]);
  });

  it("marca un tema como resuelto, lo reabre o lo elimina", async () => {
    conSesion("estudiante");
    await alternarTemaResuelto(formulario({ id: "10", resuelto: "true" }));
    expect(entorno.servidor.de("foro_temas", "update")[0].valores).toMatchObject({ resuelto: true });

    await alternarTemaResuelto(formulario({ id: "10", resuelto: "false" }));
    expect(entorno.servidor.de("foro_temas", "update")[1].valores).toMatchObject({ resuelto: false });

    await eliminarTemaForo(formulario({ id: "10" }));
    expect(entorno.servidor.de("foro_temas", "delete")[0].filtros).toEqual([["eq", "id", 10]]);
    expect(auditadas()).toEqual(["MARCAR_TEMA_RESUELTO", "REABRIR_TEMA_FORO", "ELIMINAR_TEMA_FORO"]);
  });
});
