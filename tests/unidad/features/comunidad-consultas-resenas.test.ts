import { describe, expect, it } from "vitest";
import { cursosMejorEvaluados, datosResenaPropia, listarResenasAdmin } from "@/features/comunidad/consultas-resenas";
import { entorno, responder, UUID } from "../../apoyo/entorno";

describe("reseña propia en el aula (HU-24)", () => {
  it("devuelve la reseña de la inscripción, aunque esté oculta, y si tiene certificado", async () => {
    responder({
      resenas: { data: { estrellas: 4, texto: "Muy práctico", oculta: true } },
      certificados: { data: { id: 9 } },
    });
    await expect(datosResenaPropia(UUID.inscripcion)).resolves.toEqual({
      resena: { estrellas: 4, texto: "Muy práctico", oculta: true },
      certificado: true,
    });
    expect(entorno.servidor.de("resenas")[0].filtros).toContainEqual(["eq", "inscripcion_id", UUID.inscripcion]);
    expect(entorno.servidor.de("certificados")[0].filtros).toContainEqual(["eq", "inscripcion_id", UUID.inscripcion]);
  });

  it("sin reseña ni certificado", async () => {
    await expect(datosResenaPropia(UUID.inscripcion)).resolves.toEqual({ resena: null, certificado: false });
  });
});

describe("moderación de reseñas (HU-24)", () => {
  it("lista las reseñas con el curso y el nombre del estudiante, de la más reciente a la más antigua", async () => {
    responder({
      resenas: {
        data: [
          {
            id: 3,
            estrellas: 2,
            texto: null,
            oculta: true,
            actualizada_en: "2026-10-01T15:00:00Z",
            curso: { titulo: "Excel" },
            estudiante: { nombres: "Ana", apellidos: "Quispe" },
          },
        ],
      },
    });
    await expect(listarResenasAdmin()).resolves.toEqual([
      { id: 3, curso: "Excel", estudiante: "Ana Quispe", estrellas: 2, texto: null, oculta: true, fecha: "2026-10-01T15:00:00Z" },
    ]);
    expect(entorno.servidor.de("resenas")[0].filtros).toContainEqual(["order", "actualizada_en", { ascending: false }]);
  });

  it("sin reseñas devuelve una lista vacía", async () => {
    await expect(listarResenasAdmin()).resolves.toEqual([]);
  });
});

describe("cursos mejor evaluados (HU-20)", () => {
  const cursos = ["a", "b", "c", "d", "e", "f", "g"].map((id) => ({ id, titulo: `Curso ${id.toUpperCase()}` }));

  it("ordena por promedio y luego por cantidad, solo con reseñas visibles, y toma los 5 primeros", async () => {
    responder({
      cursos: { data: cursos },
      "rpc:calificacion_cursos": {
        data: [
          { curso_id: "a", promedio: 4.2, cantidad: 3 },
          { curso_id: "b", promedio: 4.8, cantidad: 1 },
          { curso_id: "c", promedio: 4.8, cantidad: 6 },
          { curso_id: "d", promedio: 3.1, cantidad: 9 },
          { curso_id: "e", promedio: 5, cantidad: 2 },
          { curso_id: "f", promedio: 2, cantidad: 1 },
        ],
      },
    });
    await expect(cursosMejorEvaluados()).resolves.toEqual([
      { id: "e", titulo: "Curso E", promedio: 5, cantidad: 2 },
      { id: "c", titulo: "Curso C", promedio: 4.8, cantidad: 6 },
      { id: "b", titulo: "Curso B", promedio: 4.8, cantidad: 1 },
      { id: "a", titulo: "Curso A", promedio: 4.2, cantidad: 3 },
      { id: "d", titulo: "Curso D", promedio: 3.1, cantidad: 9 },
    ]);
    expect(entorno.servidor.de("rpc:calificacion_cursos")[0].valores).toEqual({ p_ids: cursos.map((c) => c.id) });
  });

  it("sin cursos no consulta las calificaciones", async () => {
    responder({ cursos: { data: [] } });
    await expect(cursosMejorEvaluados()).resolves.toEqual([]);
    expect(entorno.servidor.de("rpc:calificacion_cursos")).toHaveLength(0);
  });
});
