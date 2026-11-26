import { describe, expect, it, vi } from "vitest";
import { activarEncuesta, agregarPregunta, crearEncuesta, duplicarEncuesta, eliminarEncuesta, responderEncuesta } from "@/features/encuestas/acciones";
import { listarEncuestasAdmin, listarEncuestasEstudiante, obtenerEncuestaAdmin, obtenerEncuestaParaResponder, resultadosDeEncuesta } from "@/features/encuestas/consultas";
import { enlaceEncuestaDe } from "@/features/encuestas/enlace";
import { resultadosAExcel } from "@/features/encuestas/exportar";
import { correoCertificadoEmitido } from "@/lib/email/plantillas";
import { calcularResultados, validarRespuestas, type EnvioEncuesta, type PreguntaEncuesta, type RespuestaEncuesta } from "@/features/encuestas/resultados";
import { leerXlsx } from "../../apoyo/archivos";
import { conSesion, entorno, formulario, Redireccion, responder, UUID } from "../../apoyo/entorno";

vi.mock("@/lib/auth", () => import("../../apoyo/auth-falso"));

const preguntas: PreguntaEncuesta[] = [
  { id: 1, orden: 1, enunciado: "Contenidos útiles", tipo: "ESCALA", aspecto: "CONTENIDO", obligatoria: true },
  { id: 2, orden: 2, enunciado: "El instructor explicó bien", tipo: "ESCALA", aspecto: "INSTRUCTOR", obligatoria: true },
  { id: 3, orden: 3, enunciado: "Fácil de usar", tipo: "ESCALA", aspecto: "PLATAFORMA", obligatoria: true },
  { id: 4, orden: 4, enunciado: "¿Qué mejorarías?", tipo: "TEXTO", aspecto: null, obligatoria: false },
];

const envios: EnvioEncuesta[] = [
  { id: 10, cursoId: "excel", curso: "Excel", enviadaEn: "2026-11-01T10:00:00Z", respondidaEn: "2026-11-02T10:00:00Z" },
  { id: 11, cursoId: "excel", curso: "Excel", enviadaEn: "2026-11-01T10:00:00Z", respondidaEn: "2026-11-03T10:00:00Z" },
  { id: 12, cursoId: "redes", curso: "Redes", enviadaEn: "2026-11-01T10:00:00Z", respondidaEn: "2026-11-04T10:00:00Z" },
  { id: 13, cursoId: "redes", curso: "Redes", enviadaEn: "2026-11-01T10:00:00Z", respondidaEn: null },
];

const r = (envioId: number, preguntaId: number, valor: number | null, texto: string | null = null): RespuestaEncuesta => ({ envioId, preguntaId, valor, texto });
const respuestas: RespuestaEncuesta[] = [
  r(10, 1, 5), r(10, 2, 4), r(10, 3, 5), r(10, 4, null, "Más prácticas"),
  r(11, 1, 3), r(11, 2, 5), r(11, 3, 4),
  r(12, 1, 2), r(12, 2, 3), r(12, 3, 4), r(12, 4, null, "Mejor internet en el aula"),
  // Respuesta de un envío no respondido (no debería existir, pero no debe contar).
  r(13, 1, 1),
];

describe("resultados de la encuesta (HU-43)", () => {
  const res = calcularResultados(preguntas, envios, respuestas);

  it("calcula la tasa de respuesta, el índice de satisfacción y el % de satisfechos", () => {
    expect(res).toMatchObject({ enviadas: 4, respondidas: 3, tasaRespuesta: 75, indice: 3.89, satisfechos: 66.7 });
  });

  it("promedia cada aspecto y cada pregunta, con su distribución del 1 al 5", () => {
    expect(res.porAspecto).toEqual([
      { aspecto: "CONTENIDO", promedio: 3.33, respuestas: 3 },
      { aspecto: "INSTRUCTOR", promedio: 4, respuestas: 3 },
      { aspecto: "PLATAFORMA", promedio: 4.33, respuestas: 3 },
    ]);
    expect(res.porPregunta[0]).toMatchObject({ respuestas: 3, promedio: 3.33, distribucion: [0, 1, 1, 0, 1], satisfechos: 33.3 });
    expect(res.porPregunta[3]).toMatchObject({ respuestas: 2, promedio: null });
  });

  it("agrupa por curso y entrega los comentarios sin nombre, los más recientes primero", () => {
    expect(res.porCurso).toEqual([
      { cursoId: "excel", curso: "Excel", enviadas: 2, respondidas: 2, porAspecto: { CONTENIDO: 4, INSTRUCTOR: 4.5, PLATAFORMA: 4.5 }, general: 4.33 },
      { cursoId: "redes", curso: "Redes", enviadas: 2, respondidas: 1, porAspecto: { CONTENIDO: 2, INSTRUCTOR: 3, PLATAFORMA: 4 }, general: 3 },
    ]);
    expect(res.comentarios).toEqual([
      { pregunta: "¿Qué mejorarías?", texto: "Mejor internet en el aula", curso: "Redes", fecha: "2026-11-04T10:00:00Z" },
      { pregunta: "¿Qué mejorarías?", texto: "Más prácticas", curso: "Excel", fecha: "2026-11-02T10:00:00Z" },
    ]);
  });

  it("sin envíos no hay promedios ni tasa", () => {
    expect(calcularResultados(preguntas, [], [])).toMatchObject({ enviadas: 0, respondidas: 0, tasaRespuesta: null, indice: null, satisfechos: null, porCurso: [], comentarios: [] });
  });
});

describe("validación de respuestas (HU-43)", () => {
  it("exige las obligatorias, acepta del 1 al 5 y recorta los comentarios", () => {
    expect(validarRespuestas(preguntas, { 1: "5", 2: "4", 3: "3", 4: "  Todo bien  " })).toEqual({ ok: true, datos: { 1: 5, 2: 4, 3: 3, 4: "Todo bien" } });
    expect(validarRespuestas(preguntas, { 1: "5", 2: "4", 3: "3", 4: "" })).toEqual({ ok: true, datos: { 1: 5, 2: 4, 3: 3 } });
    expect(validarRespuestas(preguntas, { 1: "5", 2: "4" })).toEqual({ ok: false, mensaje: "Responde todas las preguntas obligatorias" });
    expect(validarRespuestas(preguntas, { 1: 7, 2: "4", 3: "3" })).toEqual({ ok: false, mensaje: "Califica cada afirmación del 1 al 5" });
    expect(validarRespuestas(preguntas, { 1: "5", 2: "4", 3: "3", 4: "x".repeat(1001) })).toEqual({ ok: false, mensaje: "Cada comentario admite hasta 1000 caracteres" });
  });
});

describe("responder la encuesta (HU-43)", () => {
  const filaEnvio = { id: 10, encuesta_id: 1, respondida_en: null, curso: { titulo: "Excel" }, encuesta: { titulo: "Satisfacción", descripcion: null } };
  const filasPreguntas = preguntas.map((p) => ({ ...p }));
  const datos = (extra: Record<string, string | undefined> = {}) => formulario({ envioId: "10", "r:1": "5", "r:2": "4", "r:3": "3", "r:4": "Gracias", ...extra });

  it("valida y guarda las respuestas con la función segura de la BD", async () => {
    conSesion("estudiante");
    responder({ "encuesta_envios.select": { data: filaEnvio }, "encuesta_preguntas.select": { data: filasPreguntas } });
    await expect(responderEncuesta({}, datos())).resolves.toEqual({ ok: true, mensaje: "¡Gracias! Tu opinión nos ayuda a mejorar" });
    expect(entorno.servidor.de("rpc:responder_encuesta")[0].valores).toEqual({ p_envio: 10, p_respuestas: { 1: 5, 2: 4, 3: 3, 4: "Gracias" } });
  });

  it("no envía nada si faltan respuestas, si ya la respondió o si no es suya", async () => {
    conSesion("estudiante");
    responder({ "encuesta_envios.select": { data: filaEnvio }, "encuesta_preguntas.select": { data: filasPreguntas } });
    await expect(responderEncuesta({}, datos({ "r:2": "" }))).resolves.toEqual({ ok: false, mensaje: "Responde todas las preguntas obligatorias" });
    responder({ "encuesta_envios.select": { data: { ...filaEnvio, respondida_en: "2026-11-02T10:00:00Z" } }, "encuesta_preguntas.select": { data: filasPreguntas } });
    await expect(responderEncuesta({}, datos())).resolves.toEqual({ ok: false, mensaje: "Ya respondiste esta encuesta" });
    responder();
    await expect(responderEncuesta({}, datos())).resolves.toEqual({ ok: false, mensaje: "Encuesta no encontrada" });
    await expect(responderEncuesta({}, formulario({ envioId: "abc" }))).resolves.toEqual({ ok: false, mensaje: "Encuesta no encontrada" });
    expect(entorno.servidor.de("rpc:responder_encuesta")).toHaveLength(0);
  });

  it("si la BD detecta que ya respondió (doble envío), lo dice", async () => {
    conSesion("estudiante");
    responder({
      "encuesta_envios.select": { data: filaEnvio },
      "encuesta_preguntas.select": { data: filasPreguntas },
      "rpc:responder_encuesta": { error: { code: "23505", message: "Ya respondiste esta encuesta" } },
    });
    await expect(responderEncuesta({}, datos())).resolves.toEqual({ ok: false, mensaje: "Ya respondiste esta encuesta" });
  });
});

describe("administración de encuestas (HU-43)", () => {
  it("crea la encuesta inactiva y lleva a agregar sus preguntas", async () => {
    conSesion("administrador");
    responder({ "encuestas.insert": { data: { id: 7 } } });
    await expect(crearEncuesta({}, formulario({ titulo: "Encuesta 2027", descripcion: "" }))).rejects.toEqual(new Redireccion("/admin/encuestas/7"));
    expect(entorno.servidor.de("encuestas", "insert")[0].valores).toEqual({ titulo: "Encuesta 2027", descripcion: null, creada_por: UUID.admin });
    await expect(crearEncuesta({}, formulario({ titulo: "x" }))).resolves.toMatchObject({ ok: false });
  });

  it("agrega preguntas al final; las de escala exigen aspecto y la BD bloquea las encuestas ya enviadas", async () => {
    conSesion("administrador");
    responder({ "encuesta_preguntas.select": { data: { orden: 3 } }, "encuesta_preguntas.insert": [{}, { error: { code: "23514", message: "bloqueada" } }] });
    await expect(agregarPregunta({}, formulario({ encuestaId: "7", enunciado: "El instructor fue puntual", tipo: "ESCALA", aspecto: "INSTRUCTOR", obligatoria: "on" }))).resolves.toEqual({ ok: true, mensaje: "Pregunta agregada" });
    expect(entorno.servidor.de("encuesta_preguntas", "insert")[0].valores).toEqual({ encuesta_id: 7, orden: 4, enunciado: "El instructor fue puntual", tipo: "ESCALA", aspecto: "INSTRUCTOR", obligatoria: true });
    await expect(agregarPregunta({}, formulario({ encuestaId: "7", enunciado: "¿Algo más?", tipo: "TEXTO", aspecto: "GENERAL" }))).resolves.toEqual({
      ok: false,
      mensaje: "La encuesta ya fue enviada: duplícala para cambiar sus preguntas",
    });
    expect(entorno.servidor.de("encuesta_preguntas", "insert")[1].valores).toMatchObject({ aspecto: null, obligatoria: false });
    await expect(agregarPregunta({}, formulario({ encuestaId: "7", enunciado: "Sin aspecto", tipo: "ESCALA", aspecto: "" }))).resolves.toEqual({ ok: false, mensaje: "Elige qué aspecto mide la pregunta" });
  });

  it("activa una sola encuesta y exige al menos una pregunta de escala", async () => {
    conSesion("administrador");
    responder({ "encuesta_preguntas.select": { count: 0 } });
    await expect(activarEncuesta(formulario({ id: "7", activa: "true" }))).resolves.toEqual({ ok: false, mensaje: "Agrega al menos una pregunta de escala antes de activarla" });

    responder({ "encuesta_preguntas.select": { count: 5 } });
    await expect(activarEncuesta(formulario({ id: "7", activa: "true" }))).resolves.toMatchObject({ ok: true });
    const cambios = entorno.servidor.de("encuestas", "update");
    expect(cambios[0]).toMatchObject({ valores: { activa: false }, filtros: [["eq", "activa", true], ["neq", "id", 7]] });
    expect(cambios[1]).toMatchObject({ valores: { activa: true }, filtros: [["eq", "id", 7]] });

    await expect(activarEncuesta(formulario({ id: "7", activa: "false" }))).resolves.toEqual({ ok: true, mensaje: "Encuesta desactivada: no se enviarán encuestas" });
  });

  it("duplica la encuesta con sus preguntas y no elimina las que ya se enviaron", async () => {
    conSesion("administrador");
    responder({
      "encuestas.select": { data: { titulo: "Satisfacción", descripcion: "2 minutos" } },
      "encuesta_preguntas.select": { data: [{ orden: 1, enunciado: "Contenidos útiles", tipo: "ESCALA", aspecto: "CONTENIDO", obligatoria: true }] },
      "encuestas.insert": { data: { id: 8 } },
    });
    await expect(duplicarEncuesta(formulario({ id: "7" }))).rejects.toEqual(new Redireccion("/admin/encuestas/8"));
    expect(entorno.servidor.de("encuestas", "insert")[0].valores).toMatchObject({ titulo: "Copia de Satisfacción", descripcion: "2 minutos" });
    expect(entorno.servidor.de("encuesta_preguntas", "insert")[0].valores).toEqual([{ orden: 1, enunciado: "Contenidos útiles", tipo: "ESCALA", aspecto: "CONTENIDO", obligatoria: true, encuesta_id: 8 }]);

    responder({ "encuesta_envios.select": { count: 3 } });
    await expect(eliminarEncuesta(formulario({ id: "7" }))).resolves.toEqual({ ok: false, mensaje: "Esta encuesta ya se envió: puedes desactivarla, pero no eliminarla" });
    expect(entorno.servidor.de("encuestas", "delete")).toHaveLength(0);
    responder({ "encuesta_envios.select": { count: 0 } });
    await expect(eliminarEncuesta(formulario({ id: "7" }))).rejects.toEqual(new Redireccion("/admin/encuestas"));
  });
});

describe("exportación de resultados (HU-43)", () => {
  it("arma el Excel con el resumen, cada pregunta, cada curso y las respuestas sin nombre", async () => {
    const libro = leerXlsx(
      await resultadosAExcel({ titulo: "Satisfacción", curso: null, preguntas, envios, respuestas, resultados: calcularResultados(preguntas, envios, respuestas) }),
    );
    expect(libro.hojas).toEqual(["Resumen", "Por pregunta", "Por curso", "Respuestas"]);
    expect(libro.hoja("Resumen").slice(4, 9)).toEqual([
      ["Encuestas enviadas", "4"],
      ["Encuestas respondidas", "3"],
      ["Tasa de respuesta", "0.75"],
      ["Índice de satisfacción (1 a 5)", "3.89"],
      ["Satisfechos (respuestas con 4 o 5)", "0.667"],
    ]);
    expect(libro.hoja("Por curso")[4]).toEqual(["Excel", "2", "2", "4", "4.5", "4.5", "4.33"]);
    const respuestasHoja = libro.hoja("Respuestas");
    expect(respuestasHoja[3]).toEqual(["Fecha", "Curso", "P1 · Contenido", "P2 · Instructor", "P3 · Plataforma", "P4 · ¿Qué mejorarías?"]);
    expect(respuestasHoja.slice(4, 7).map((f) => f.slice(1))).toEqual([
      ["Excel", "5", "4", "5", "Más prácticas"],
      ["Excel", "3", "5", "4", ""],
      ["Redes", "2", "3", "4", "Mejor internet en el aula"],
    ]);
  });
});

describe("consultas de encuestas (HU-43)", () => {
  it("el estudiante ve sus encuestas, las pendientes primero", async () => {
    responder({
      encuesta_envios: {
        data: [
          { id: 1, enviada_en: "2026-11-01T10:00:00Z", respondida_en: "2026-11-02T10:00:00Z", curso: { titulo: "Excel" }, encuesta: { titulo: "Satisfacción" } },
          { id: 2, enviada_en: "2026-10-01T10:00:00Z", respondida_en: null, curso: { titulo: "Redes" }, encuesta: null },
        ],
      },
    });
    await expect(listarEncuestasEstudiante(UUID.estudiante)).resolves.toEqual([
      { envioId: 2, curso: "Redes", titulo: "Encuesta de satisfacción", enviadaEn: "2026-10-01T10:00:00Z", respondidaEn: null },
      { envioId: 1, curso: "Excel", titulo: "Satisfacción", enviadaEn: "2026-11-01T10:00:00Z", respondidaEn: "2026-11-02T10:00:00Z" },
    ]);
    expect(entorno.servidor.de("encuesta_envios")[0].filtros).toContainEqual(["eq", "estudiante_id", UUID.estudiante]);
  });

  it("trae la encuesta para responder con sus preguntas en orden, o null si no es suya", async () => {
    responder({
      "encuesta_envios.select": { data: { id: 5, encuesta_id: 1, respondida_en: null, curso: { titulo: "Excel" }, encuesta: { titulo: "Satisfacción", descripcion: "2 minutos" } } },
      "encuesta_preguntas.select": { data: preguntas },
    });
    await expect(obtenerEncuestaParaResponder(5)).resolves.toMatchObject({ envioId: 5, curso: "Excel", titulo: "Satisfacción", descripcion: "2 minutos", respondidaEn: null, preguntas });
    expect(entorno.servidor.de("encuesta_preguntas")[0].filtros).toEqual([["eq", "encuesta_id", 1], ["order", "orden"]]);
    responder();
    await expect(obtenerEncuestaParaResponder(5)).resolves.toBeNull();
  });

  it("el administrador ve cada encuesta con sus totales y si sus preguntas están bloqueadas", async () => {
    responder({
      encuestas: { data: [{ id: 1, titulo: "Satisfacción", descripcion: null, activa: true, creada_en: "2026-11-01T10:00:00Z" }] },
      encuesta_preguntas: { data: [{ encuesta_id: 1 }, { encuesta_id: 1 }, { encuesta_id: 2 }] },
      encuesta_envios: { data: [{ encuesta_id: 1, respondida_en: "2026-11-02T10:00:00Z" }, { encuesta_id: 1, respondida_en: null }] },
    });
    await expect(listarEncuestasAdmin()).resolves.toEqual([
      { id: 1, titulo: "Satisfacción", descripcion: null, activa: true, creadaEn: "2026-11-01T10:00:00Z", preguntas: 2, enviadas: 2, respondidas: 1 },
    ]);

    responder({
      "encuestas.select": { data: { id: 1, titulo: "Satisfacción", descripcion: null, activa: true } },
      "encuesta_preguntas.select": { data: preguntas },
      "encuesta_envios.select": { count: 2 },
    });
    await expect(obtenerEncuestaAdmin(1)).resolves.toMatchObject({ id: 1, bloqueada: true, preguntas });
    responder();
    await expect(obtenerEncuestaAdmin(1)).resolves.toBeNull();
  });

  it("los resultados solo leen las respuestas de los envíos respondidos (y de un curso, si se filtra)", async () => {
    responder({
      encuesta_envios: { data: [{ id: 10, curso_id: "excel", enviada_en: "2026-11-01T10:00:00Z", respondida_en: "2026-11-02T10:00:00Z", curso: { titulo: "Excel" } }, { id: 11, curso_id: "excel", enviada_en: "2026-11-01T10:00:00Z", respondida_en: null, curso: null }] },
      encuesta_respuestas: { data: [{ envio_id: 10, pregunta_id: 1, valor: 4, texto: null }] },
    });
    const { resultados, envios: lista } = await resultadosDeEncuesta(1, preguntas, "excel");
    expect(entorno.servidor.de("encuesta_envios")[0].filtros).toEqual([["eq", "encuesta_id", 1], ["eq", "curso_id", "excel"]]);
    expect(entorno.servidor.de("encuesta_respuestas")[0].filtros).toEqual([["in", "envio_id", [10]]]);
    expect(lista[1].curso).toBe("Curso");
    expect(resultados).toMatchObject({ enviadas: 2, respondidas: 1, indice: 4 });

    responder({ encuesta_envios: { data: [] } });
    await expect(resultadosDeEncuesta(1, preguntas)).resolves.toMatchObject({ resultados: { enviadas: 0 } });
    expect(entorno.servidor.de("encuesta_respuestas")).toHaveLength(0);
  });

  it("el correo del certificado incluye el enlace a la encuesta que se envió", async () => {
    responder({}, { "encuesta_envios.select": [{ data: { id: 42 } }, { data: null }] });
    await expect(enlaceEncuestaDe(UUID.inscripcion)).resolves.toBe("https://pedsar.test/estudiante/encuestas/42");
    await expect(enlaceEncuestaDe(UUID.inscripcion)).resolves.toBeNull();
    const correo = correoCertificadoEmitido({ nombre: "Ana", curso: "Excel", codigo: "PED-2026-X", url: "https://pedsar.test/verificar", encuestaUrl: "https://pedsar.test/estudiante/encuestas/42" });
    expect(correo.html).toContain("encuesta de satisfacción");
    expect(correo.html).toContain("https://pedsar.test/estudiante/encuestas/42");
    expect(correoCertificadoEmitido({ nombre: "Ana", curso: "Excel", codigo: "PED-2026-X", url: "https://pedsar.test/verificar" }).html).not.toContain("encuesta");
  });
});
