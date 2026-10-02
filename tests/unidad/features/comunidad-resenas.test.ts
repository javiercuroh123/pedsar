import { revalidatePath } from "next/cache";
import { describe, expect, it, vi } from "vitest";
import { alternarResena, guardarResena } from "@/features/comunidad/resenas";
import { conSesion, entorno, formulario, Redireccion, responder, UUID } from "../../apoyo/entorno";

vi.mock("@/lib/auth", () => import("../../apoyo/auth-falso"));

const INSCRIPCION = { data: { id: UUID.inscripcion, curso_id: UUID.curso, curso: { slug: "excel" } } };
const auditadas = () => entorno.admin.de("registro_actividad").map((c) => (c.valores as { accion: string }).accion);

describe("calificar un curso completado (HU-24)", () => {
  it("guarda o actualiza la reseña de la inscripción y actualiza el curso", async () => {
    conSesion("estudiante");
    responder({ inscripciones: INSCRIPCION });
    await expect(guardarResena({}, formulario({ inscripcionId: UUID.inscripcion, estrellas: "4", texto: "  Muy práctico  " }))).resolves.toEqual({
      ok: true,
      mensaje: "¡Gracias por tu reseña!",
    });
    expect(entorno.servidor.de("inscripciones")[0].filtros).toEqual(expect.arrayContaining([["eq", "id", UUID.inscripcion], ["eq", "estudiante_id", UUID.estudiante]]));
    const upsert = entorno.servidor.de("resenas", "upsert")[0];
    expect(upsert.valores).toEqual({ inscripcion_id: UUID.inscripcion, curso_id: UUID.curso, estudiante_id: UUID.estudiante, estrellas: 4, texto: "Muy práctico" });
    expect(upsert.opciones).toEqual({ onConflict: "inscripcion_id" });
    expect(revalidatePath).toHaveBeenCalledWith("/cursos/excel");
    expect(auditadas()).toEqual(["RESENA_GUARDADA"]);
  });

  it("sin texto guarda solo las estrellas", async () => {
    conSesion("estudiante");
    responder({ inscripciones: INSCRIPCION });
    await guardarResena({}, formulario({ inscripcionId: UUID.inscripcion, estrellas: "5", texto: "   " }));
    expect(entorno.servidor.de("resenas", "upsert")[0].valores).toMatchObject({ estrellas: 5, texto: null });
  });

  it("si aún no completó el curso, la BD la rechaza y se explica", async () => {
    conSesion("estudiante");
    responder({ inscripciones: INSCRIPCION, resenas: { error: { code: "42501", message: "new row violates row-level security policy" } } });
    await expect(guardarResena({}, formulario({ inscripcionId: UUID.inscripcion, estrellas: "4" }))).resolves.toEqual({
      ok: false,
      mensaje: "Podrás calificar el curso cuando lo completes",
    });
    expect(auditadas()).toEqual([]);
  });

  it.each([
    ["0 estrellas", { estrellas: "0" }, "Elige de 1 a 5 estrellas"],
    ["6 estrellas", { estrellas: "6" }, "Elige de 1 a 5 estrellas"],
    ["un texto largo", { estrellas: "3", texto: "z".repeat(501) }, "La reseña puede tener hasta 500 caracteres"],
  ])("rechaza %s sin consultar la BD", async (_, datos, mensaje) => {
    conSesion("estudiante");
    await expect(guardarResena({}, formulario({ inscripcionId: UUID.inscripcion, ...datos }))).resolves.toEqual({ ok: false, mensaje });
    expect(entorno.servidor.consultas).toHaveLength(0);
  });

  it("no califica con una inscripción ajena", async () => {
    conSesion("estudiante");
    responder({ inscripciones: { data: null } });
    await expect(guardarResena({}, formulario({ inscripcionId: UUID.inscripcion, estrellas: "4" }))).resolves.toEqual({ ok: false, mensaje: "No encontramos tu inscripción" });
    expect(entorno.servidor.de("resenas")).toHaveLength(0);
  });
});

describe("moderar reseñas", () => {
  it("el administrador oculta o vuelve a mostrar una reseña", async () => {
    conSesion("administrador");
    await alternarResena(formulario({ id: "3", oculta: "true" }));
    expect(entorno.servidor.de("resenas", "update")[0]).toMatchObject({ valores: { oculta: true }, filtros: [["eq", "id", 3]] });
    await alternarResena(formulario({ id: "3", oculta: "false" }));
    expect(entorno.servidor.de("resenas", "update")[1].valores).toEqual({ oculta: false });
    expect(auditadas()).toEqual(["OCULTAR_RESENA", "MOSTRAR_RESENA"]);
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("solo el administrador modera", async () => {
    conSesion("estudiante");
    await expect(alternarResena(formulario({ id: "3", oculta: "true" }))).rejects.toBeInstanceOf(Redireccion);
    expect(entorno.servidor.de("resenas")).toHaveLength(0);
  });
});
