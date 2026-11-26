import { describe, expect, it } from "vitest";
import { estudiantesDeBandeja, filtrarBandeja, leerFiltrosBandeja, noLeidosPorCurso } from "@/features/comunidad/bandeja";
import type { ConversacionResumen } from "@/features/comunidad/consultas";
import { UUID } from "../../apoyo/entorno";

const EXCEL = UUID.curso;
const REDES = UUID.otra;
const ANA = UUID.estudiante;
const LUIS = UUID.inscripcion;

const conversacion = (id: number, cursoId: string, estudianteId: string, otro: string, noLeidos: number): ConversacionResumen => ({
  id,
  cursoId,
  curso: cursoId === EXCEL ? "Excel" : "Redes",
  otro,
  ultimoMensaje: "Hola",
  ultimoEn: "2026-10-02T15:00:00Z",
  noLeidos,
  estudianteId,
});

const bandeja = [
  conversacion(1, EXCEL, ANA, "Ana Quispe", 2),
  conversacion(2, EXCEL, LUIS, "Luis Ramos", 0),
  conversacion(3, REDES, ANA, "Ana Quispe", 1),
];
const ids = (items: ConversacionResumen[]) => items.map((c) => c.id);

describe("bandeja unificada del instructor (HU-52)", () => {
  it("filtra por curso, por estudiante y por estado, y combina los filtros", () => {
    expect(ids(filtrarBandeja(bandeja, {}))).toEqual([1, 2, 3]);
    expect(ids(filtrarBandeja(bandeja, { curso: EXCEL }))).toEqual([1, 2]);
    expect(ids(filtrarBandeja(bandeja, { estudiante: ANA }))).toEqual([1, 3]);
    expect(ids(filtrarBandeja(bandeja, { estado: "sin-leer" }))).toEqual([1, 3]);
    expect(ids(filtrarBandeja(bandeja, { estado: "leidos" }))).toEqual([2]);
    expect(ids(filtrarBandeja(bandeja, { curso: EXCEL, estudiante: ANA, estado: "sin-leer" }))).toEqual([1]);
    expect(ids(filtrarBandeja(bandeja, { curso: REDES, estado: "leidos" }))).toEqual([]);
  });

  it("cuenta los mensajes sin leer de cada curso", () => {
    expect(noLeidosPorCurso(bandeja)).toEqual(
      new Map([
        [EXCEL, 2],
        [REDES, 1],
      ]),
    );
    expect(noLeidosPorCurso([conversacion(2, EXCEL, LUIS, "Luis Ramos", 0)]).size).toBe(0);
  });

  it("lista los estudiantes sin repetir, por nombre y solo del curso elegido", () => {
    expect(estudiantesDeBandeja(bandeja)).toEqual([
      { id: ANA, nombre: "Ana Quispe" },
      { id: LUIS, nombre: "Luis Ramos" },
    ]);
    expect(estudiantesDeBandeja(bandeja, REDES)).toEqual([{ id: ANA, nombre: "Ana Quispe" }]);
  });

  it("de la URL solo acepta cursos propios, estudiantes de la bandeja y estados conocidos", () => {
    const cursos = [EXCEL, REDES];
    expect(leerFiltrosBandeja({ curso: EXCEL, estudiante: LUIS, estado: "sin-leer" }, bandeja, cursos)).toEqual({ curso: EXCEL, estudiante: LUIS, estado: "sin-leer" });
    // Curso ajeno, estudiante que no escribió en ese curso y estado inventado se ignoran.
    expect(leerFiltrosBandeja({ curso: UUID.pago, estado: "archivados" }, bandeja, cursos)).toEqual({});
    expect(leerFiltrosBandeja({ curso: REDES, estudiante: LUIS }, bandeja, cursos)).toEqual({ curso: REDES });
    // Valores vacíos o repetidos en la URL (?curso=&curso=…) cuentan como «todos».
    expect(leerFiltrosBandeja({ curso: "", estudiante: [ANA, LUIS], estado: undefined }, bandeja, cursos)).toEqual({});
  });
});
