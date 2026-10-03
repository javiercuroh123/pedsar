import { describe, expect, it, vi } from "vitest";
import {
  calcularProgreso,
  listarEvaluacionesEstudiante,
  listarMisInscripciones,
  listarModulosConContenidos,
  listarSesionesProximas,
  uno,
} from "@/features/academico/consultas";
import { elegirCurso, listarCursosDelInstructor, listarEstudiantesDelCurso, listarSesionesDeCursos, type CursoInstructor } from "@/features/academico/consultas-instructor";
import { reporteCursoAExcel, reporteCursoAPdf } from "@/features/academico/exportar-reporte-curso";
import { reporteDelCurso, type ReporteCurso } from "@/features/academico/reporte-instructor";
import { leerPdf, leerXlsx } from "../../apoyo/archivos";
import { entorno, perfil, responder, UUID } from "../../apoyo/entorno";

describe("utilidades de consulta", () => {
  it("normaliza relaciones de PostgREST (objeto o arreglo)", () => {
    expect(uno([{ a: 1 }, { a: 2 }])).toEqual({ a: 1 });
    expect(uno([])).toBeNull();
    expect(uno({ a: 1 })).toEqual({ a: 1 });
    expect(uno(undefined)).toBeNull();
  });
});

describe("mis cursos y progreso del estudiante (HU-10 · HU-28)", () => {
  it("calcula el progreso por inscripción con el total de contenidos de su curso", async () => {
    await expect(calcularProgreso([])).resolves.toEqual(new Map());
    responder({
      modulos: { data: [{ curso_id: "c1", contenidos: [{}, {}] }, { curso_id: "c1", contenidos: [{}, {}] }, { curso_id: "c2", contenidos: null }] },
      contenidos_completados: { data: [{ inscripcion_id: "i1" }, { inscripcion_id: "i1" }, { inscripcion_id: "i1" }, { inscripcion_id: "i2" }] },
    });
    const p = await calcularProgreso([
      { inscripcionId: "i1", cursoId: "c1" },
      { inscripcionId: "i2", cursoId: "c2" },
    ]);
    expect(p.get("i1")).toEqual({ completadas: 3, total: 4, porcentaje: 75 });
    expect(p.get("i2")).toEqual({ completadas: 0, total: 0, porcentaje: 0 });
  });

  it("arma cada inscripción con su pago, comprobante, certificado y progreso", async () => {
    responder({
      inscripciones: {
        data: [
          {
            id: "i1",
            codigo: "MAT-1",
            estado: "CONFIRMADA",
            fecha_inscripcion: "2026-09-01T10:00:00Z",
            vence_en: null,
            curso: { id: "c1", slug: "excel", titulo: "Excel", modalidad: "VIRTUAL", duracion_horas: 24, categoria: [{ nombre: "Ofimática", slug: "ofimatica" }] },
            pagos: [{ id: "p1", monto: "180.00", metodo: "YAPE", estado: "APROBADO", fecha_pago: "2026-09-02", numero_operacion: "001", reportado_en: null, observacion: null, comprobantes: [] }],
            certificados: [{ codigo_unico: "PED-1" }],
          },
          { id: "i2", codigo: "MAT-2", estado: "PENDIENTE", fecha_inscripcion: "2026-09-05T10:00:00Z", vence_en: "2026-09-07T10:00:00Z", curso: { id: "c2", categoria: null }, pagos: [], certificados: [] },
        ],
      },
      modulos: { data: [{ curso_id: "c1", contenidos: [{}, {}] }] },
      contenidos_completados: { data: [{ inscripcion_id: "i1" }] },
    });
    const [confirmada, pendiente] = await listarMisInscripciones(UUID.estudiante);
    expect(confirmada).toMatchObject({
      curso: { titulo: "Excel", categoria: { slug: "ofimatica" } },
      pago: { monto: 180, metodo: "YAPE", comprobante: null },
      certificado: { codigo_unico: "PED-1" },
      progreso: { completadas: 1, total: 2, porcentaje: 50 },
    });
    expect(pendiente).toMatchObject({ pago: null, certificado: null, vence_en: "2026-09-07T10:00:00Z", progreso: { porcentaje: 0 } });
    // El progreso solo se calcula para las inscripciones confirmadas.
    expect(entorno.servidor.de("contenidos_completados")[0].filtros).toEqual([["in", "inscripcion_id", ["i1"]]]);

    responder({ inscripciones: { error: { message: "RLS" } } });
    await expect(listarMisInscripciones(UUID.estudiante)).rejects.toThrow("Inscripciones: RLS");
  });

  it("lista sesiones próximas, evaluaciones con su mejor intento y el aula ordenada", async () => {
    await expect(listarSesionesProximas([], "2026-10-01")).resolves.toEqual([]);
    await expect(listarEvaluacionesEstudiante([])).resolves.toEqual([]);
    responder({
      sesiones: { data: [{ id: 1, fecha: "2026-10-02", curso: { id: "c1", titulo: "Excel", categoria: { slug: "ofimatica" } } }] },
      evaluaciones: { data: [{ id: 5, titulo: "Final", puntaje_total: "20", intentos_permitidos: 2, tiempo_limite_min: null, curso_id: "c1" }] },
      intentos_evaluacion: {
        data: [
          { evaluacion_id: 5, inscripcion_id: "i1", numero_intento: 2, puntaje_obtenido: "16" },
          { evaluacion_id: 5, inscripcion_id: "i1", numero_intento: 1, puntaje_obtenido: "11" },
          { evaluacion_id: 5, inscripcion_id: "otra", numero_intento: 1, puntaje_obtenido: "20" },
        ],
      },
      modulos: { data: [{ id: 1, titulo: "M1", orden: 1, contenidos: [{ id: 2, orden: 2 }, { id: 1, orden: 1 }] }, { id: 2, titulo: "M2", orden: 2, contenidos: null }] },
    });
    const [sesion] = await listarSesionesProximas(["c1"], "2026-10-01", 3);
    expect(sesion.curso).toEqual({ id: "c1", titulo: "Excel", categoria: "ofimatica" });
    expect(entorno.servidor.de("sesiones")[0].filtros).toContainEqual(["limit", 3]);

    const [ev] = await listarEvaluacionesEstudiante([{ id: "i1", cursoId: "c1", titulo: "Excel" }]);
    expect(ev).toMatchObject({ puntaje_total: 20, mejor: 16, inscripcionId: "i1", curso: { titulo: "Excel" } });
    expect(ev.intentos.map((i) => i.numero_intento)).toEqual([1, 2]);

    const modulos = await listarModulosConContenidos("c1");
    expect(modulos[0].contenidos.map((c) => c.id)).toEqual([1, 2]);
    expect(modulos[1].contenidos).toEqual([]);
  });
});

describe("consultas del instructor", () => {
  const curso: CursoInstructor = { id: UUID.curso, slug: "excel", titulo: "Excel Avanzado", estado: "PUBLICADO", modalidad: "VIRTUAL", cupo_maximo: 30, categoria: null };

  it("el instructor ve solo sus cursos y el administrador todos", async () => {
    responder({ cursos: { data: [{ ...curso, categoria: [{ slug: "ofimatica", nombre: "Ofimática" }] }] } });
    const cursos = await listarCursosDelInstructor(perfil("instructor"));
    expect(cursos[0].categoria).toEqual({ slug: "ofimatica", nombre: "Ofimática" });
    expect(entorno.servidor.de("cursos")[0].filtros).toContainEqual(["eq", "instructor_id", UUID.instructor]);
    await listarCursosDelInstructor(perfil("administrador"));
    expect(entorno.servidor.de("cursos")[1].filtros.some((f) => f[0] === "eq")).toBe(false);

    expect(elegirCurso(cursos, UUID.curso)?.id).toBe(UUID.curso);
    expect(elegirCurso(cursos, "otro")?.id).toBe(UUID.curso);
    expect(elegirCurso([], undefined)).toBeNull();
  });

  it("lista los estudiantes confirmados en orden alfabético y las sesiones", async () => {
    responder(
      { sesiones: { data: [{ id: 1 }] } },
      {
        inscripciones: {
          data: [
            { id: "i2", estudiante: { id: "e2", nombres: "Óscar", apellidos: "Zapata", correo: "o@x.pe", telefono: null, avatar_url: null } },
            { id: "i1", estudiante: [{ id: "e1", nombres: "", apellidos: "", correo: "ana@x.pe", telefono: "987", avatar_url: "a.png" }] },
            { id: "i3", estudiante: { id: "e3", nombres: "Beto", apellidos: "Ríos", correo: "b@x.pe", telefono: null, avatar_url: null } },
          ],
        },
      },
    );
    const estudiantes = await listarEstudiantesDelCurso(UUID.curso);
    expect(estudiantes.map((e) => e.nombre)).toEqual(["ana@x.pe", "Beto Ríos", "Óscar Zapata"]);
    expect(estudiantes[0]).toMatchObject({ inscripcionId: "i1", telefono: "987", avatar: "a.png" });
    expect(entorno.admin.de("inscripciones")[0].filtros).toContainEqual(["eq", "estado", "CONFIRMADA"]);

    await expect(listarSesionesDeCursos([])).resolves.toEqual([]);
    await expect(listarSesionesDeCursos([UUID.curso])).resolves.toEqual([{ id: 1 }]);
  });

  it("el reporte del curso usa la nota final y los requisitos de los certificados (HU-42)", async () => {
    vi.useFakeTimers({ now: new Date("2026-10-15T17:00:00Z") });
    const estudiante = (id: string, nombres: string) => ({ id, estudiante: { id: `e-${id}`, nombres, apellidos: "", correo: `${nombres}@x.pe`, telefono: null, avatar_url: null } });
    const resultado = (id: string, r: Record<string, unknown>) => ({ inscripcion_id: id, evaluaciones: 2, rendidas: 2, nota_final: 15, sesiones: 2, presentes: 2, asistencia: 100, contenidos: 4, completados: 2, progreso: 50, ...r });
    responder(
      {
        evaluaciones: { data: [{ id: 1, titulo: "Parcial", puntaje_total: "20" }, { id: 2, titulo: "Final", puntaje_total: "10" }] },
        sesiones: { data: [{ id: 10, fecha: "2026-10-01", hora_inicio: "19:00" }, { id: 11, fecha: "2026-10-08", hora_inicio: "19:00" }] },
        intentos_evaluacion: {
          data: [
            { inscripcion_id: "apto", evaluacion_id: 1, puntaje_obtenido: "12" },
            { inscripcion_id: "apto", evaluacion_id: 1, puntaje_obtenido: "16" },
            { inscripcion_id: "apto", evaluacion_id: 2, puntaje_obtenido: "8" },
            { inscripcion_id: "riesgo", evaluacion_id: 1, puntaje_obtenido: "10" },
            { inscripcion_id: "riesgo", evaluacion_id: 2, puntaje_obtenido: null },
          ],
        },
        asistencias: { data: [{ inscripcion_id: "apto", sesion_id: 10, estado: "PRESENTE" }, { inscripcion_id: "apto", sesion_id: 11, estado: "TARDANZA" }, { inscripcion_id: "riesgo", sesion_id: 10, estado: "AUSENTE" }] },
        "rpc:resultado_academico": {
          data: [
            resultado("apto", {}),
            resultado("riesgo", { rendidas: 1, nota_final: 5, presentes: 0, asistencia: 0 }),
            resultado("nuevo", { rendidas: 0, nota_final: 0, sesiones: 0, presentes: 0, asistencia: null, progreso: null }),
          ],
        },
      },
      { inscripciones: { data: [estudiante("apto", "Ana"), estudiante("riesgo", "Beto"), estudiante("nuevo", "Carla")] } },
    );
    const r = await reporteDelCurso(curso);
    expect(entorno.servidor.de("sesiones")[0].filtros).toContainEqual(["lte", "fecha", "2026-10-15"]);
    expect(r.evaluaciones.map((e) => e.puntaje_total)).toEqual([20, 10]);
    const [ana, beto, carla] = r.estudiantes;
    expect(ana).toMatchObject({ notas: [16, 8], notaParcial: 16, notaFinal: 15, asistencia: 100, progreso: 50, asistenciaPorSesion: ["PRESENTE", "TARDANZA"], estado: "APTO", motivos: [] });
    expect(beto).toMatchObject({ notas: [10, null], notaParcial: 10, rendidas: 1, asistencia: 0, asistenciaPorSesion: ["AUSENTE", null], estado: "EN_RIESGO" });
    expect(carla).toMatchObject({ notas: [null, null], notaParcial: null, asistencia: null, progreso: 0, estado: "EN_CURSO" });
  });

  it("un curso sin estudiantes no consulta intentos ni asistencias", async () => {
    responder({ evaluaciones: { data: null }, sesiones: { data: null } }, { inscripciones: { data: [] } });
    const r = await reporteDelCurso(curso);
    expect(r).toMatchObject({ evaluaciones: [], sesiones: [], estudiantes: [] });
    expect(entorno.servidor.de("intentos_evaluacion")).toHaveLength(0);
    expect(entorno.servidor.de("rpc:resultado_academico")).toHaveLength(0);
  });

  describe("exportación del reporte del curso", () => {
    const fila = (nombre: string, extra: Partial<ReporteCurso["estudiantes"][number]> = {}): ReporteCurso["estudiantes"][number] => ({
      inscripcionId: nombre,
      estudianteId: nombre,
      nombre,
      correo: `${nombre}@x.pe`,
      telefono: null,
      avatar: null,
      notas: [16, null],
      notaParcial: 16,
      notaFinal: 12.96,
      rendidas: 1,
      asistencia: 74.6,
      presentes: 1,
      progreso: 40,
      asistenciaPorSesion: ["PRESENTE", "AUSENTE", "TARDANZA", null],
      estado: "EN_RIESGO",
      motivos: ["Faltan rendir 1 de 2 evaluaciones"],
      ...extra,
    });
    const reporte = (sesiones = 4, evaluaciones = 2): ReporteCurso => ({
      curso,
      evaluaciones: Array.from({ length: evaluaciones }, (_, i) => ({ id: i + 1, titulo: `Evaluación ${i + 1}`, puntaje_total: 20 })),
      sesiones: Array.from({ length: sesiones }, (_, i) => ({ id: i + 1, fecha: `2026-09-${String(i + 1).padStart(2, "0")}`, hora_inicio: "19:00" })),
      estudiantes: [fila("Ana", { telefono: "987654321" }), fila("Beto", { notaFinal: null, asistencia: null, estado: "APTO", motivos: [] })],
    });

    it("el Excel trae estudiantes, calificaciones y asistencia con valores exactos", async () => {
      const xlsx = leerXlsx(await reporteCursoAExcel(reporte()));
      expect(xlsx.hojas).toEqual(["Estudiantes", "Calificaciones", "Asistencia"]);
      const estudiantes = xlsx.hoja("Estudiantes");
      expect(estudiantes[3]).toEqual(["Estudiante", "Correo", "Teléfono", "Avance", "Asistencia", "Nota final", "Evaluaciones rendidas", "Estado", "Pendiente para el certificado"]);
      expect(estudiantes[4]).toEqual(["Ana", "Ana@x.pe", "987654321", "0.4", "0.746", "12.96", "1 de 2", "En riesgo", "Faltan rendir 1 de 2 evaluaciones"]);
      expect(estudiantes[5].slice(4, 6)).toEqual(["", ""]);
      expect(xlsx.hoja("Calificaciones")[4]).toEqual(["Ana", "16", "", "16", "12.96"]);
      expect(xlsx.hoja("Asistencia")[4]).toEqual(["Ana", "P", "A", "T", "—", "1", "0.746"]);
      expect(xlsx.zip.get("xl/styles.xml")).toContain('formatCode="0.00"');
      expect(xlsx.zip.get("xl/styles.xml")).toContain('formatCode="0.0%"');
    });

    it("el PDF trunca nota y asistencia y limita las columnas de sesiones", async () => {
      const { texto } = await leerPdf(await reporteCursoAPdf(reporte(18, 15)));
      expect(texto).toContain("Reporte académico del curso");
      expect(texto).toContain("12.9");
      expect(texto).not.toContain("13.0");
      expect(texto).toContain("74 %");
      expect(texto).toContain("Calificaciones (primeras 14 evaluaciones; el detalle completo está en el Excel)");
      expect(texto).toContain("Asistencia (últimas 14 sesiones; el detalle completo está en el Excel)");
      expect(texto).toContain("nota final >= 13");
    });

    it("el PDF de un curso sin estudiantes ni sesiones lo indica", async () => {
      const { texto } = await leerPdf(await reporteCursoAPdf({ ...reporte(0, 0), estudiantes: [] }));
      expect(texto).toContain("Aún no hay estudiantes confirmados en este curso.");
      expect(texto).not.toContain("Calificaciones");
    });
  });
});
