import { describe, expect, it, vi } from "vitest";
import { reporteAExcel, reporteAPdf } from "@/features/administracion/exportar-reporte";
import { etiquetaMes, generarReporte, rangoPorDefecto } from "@/features/administracion/reportes";
import { listarCategorias, listarCursosPublicados, obtenerCursoPorSlug } from "@/features/catalogo/consultas";
import { leerPdf, leerXlsx } from "../../apoyo/archivos";
import { entorno, responder } from "../../apoyo/entorno";

describe("reporte general del administrador (RF-10 · HU-20)", () => {
  const inscripcion = (curso: string, estado: string, fecha: string, pago?: { monto: string; metodo: string; medio?: string; estado: string }) => ({
    curso_id: curso,
    estado,
    fecha_inscripcion: fecha,
    pagos: pago ? [pago] : [],
  });
  const preparar = () =>
    responder({
      cursos: {
        data: [
          { id: "c1", titulo: "Excel", modalidad: "VIRTUAL", cupo_maximo: 30 },
          { id: "c2", titulo: "Power BI", modalidad: "PRESENCIAL", cupo_maximo: 20 },
          { id: "c3", titulo: "Sin inscritos", modalidad: "VIRTUAL", cupo_maximo: 10 },
        ],
      },
      inscripciones: {
        data: [
          inscripcion("c1", "CONFIRMADA", "2026-08-31T23:30:00-05:00", { monto: "180.00", metodo: "YAPE", estado: "APROBADO" }),
          inscripcion("c1", "CONFIRMADA", "2026-09-10T10:00:00-05:00", { monto: "144.00", metodo: "PLIN", estado: "APROBADO" }),
          inscripcion("c1", "PENDIENTE", "2026-09-11T10:00:00-05:00", { monto: "180.00", metodo: "YAPE", estado: "PENDIENTE" }),
          inscripcion("c2", "CONFIRMADA", "2026-09-12T10:00:00-05:00", { monto: "300.00", metodo: "YAPE", estado: "APROBADO" }),
        ],
      },
      perfiles: (c) => ({ count: c.filtros.length === 0 ? 50 : c.filtros.some((f) => f[1] === "rol" && f[2] === "instructor") ? 3 : 10 }),
    });

  it("suma inscripciones e ingresos aprobados por curso, método y mes (hora de Perú)", async () => {
    preparar();
    const r = await generarReporte("2026-08-01", "2026-09-30");
    const ins = entorno.servidor.de("inscripciones")[0];
    expect(ins.filtros).toEqual([
      ["neq", "estado", "CANCELADA"],
      ["gte", "fecha_inscripcion", "2026-08-01T00:00:00-05:00"],
      ["lte", "fecha_inscripcion", "2026-09-30T23:59:59-05:00"],
    ]);
    expect(r.porCurso.map((f) => [f.titulo, f.inscritos, f.confirmados, f.ingresos])).toEqual([
      ["Excel", 3, 2, 324],
      ["Power BI", 1, 1, 300],
    ]);
    expect(r.porCurso[0].porMetodo).toEqual({ Yape: 180, Plin: 144 });
    expect(r.porMetodo).toEqual([
      { metodo: "Yape", monto: 480 },
      { metodo: "Plin", monto: 144 },
    ]);
    // 23:30 del 31 de agosto en Lima es agosto, aunque en UTC ya sea setiembre.
    expect(r.porMes).toEqual([
      { mes: "2026-08", inscritos: 1, confirmados: 1, ingresos: 180 },
      { mes: "2026-09", inscritos: 3, confirmados: 2, ingresos: 444 },
    ]);
    expect(r.totales).toEqual({ inscritos: 4, confirmados: 3, ingresos: 624 });
    expect(r.usuarios).toEqual({ registrados: 50, activos: 10, nuevos: 10, estudiantes: 10, instructores: 3 });
    expect(r.curso).toBeNull();
  });

  it("separa los ingresos del pago en línea por medio de los pagos directos", async () => {
    responder({
      cursos: { data: [{ id: "c1", titulo: "Excel", modalidad: "VIRTUAL", cupo_maximo: 30 }] },
      inscripciones: {
        data: [
          inscripcion("c1", "CONFIRMADA", "2026-09-10T10:00:00-05:00", { monto: "144.00", metodo: "CULQI", medio: "YAPE", estado: "APROBADO" }),
          inscripcion("c1", "CONFIRMADA", "2026-09-11T10:00:00-05:00", { monto: "180.00", metodo: "CULQI", medio: "TARJETA", estado: "APROBADO" }),
          inscripcion("c1", "CONFIRMADA", "2026-09-12T10:00:00-05:00", { monto: "100.00", metodo: "YAPE", estado: "APROBADO" }),
        ],
      },
      perfiles: { count: 1 },
    });
    const r = await generarReporte("2026-09-01", "2026-09-30");
    expect(entorno.servidor.de("inscripciones")[0].columnas).toContain("medio");
    expect(r.porCurso[0].porMetodo).toEqual({ "Culqi · Yape": 144, "Culqi · Tarjeta": 180, Yape: 100 });
    expect(r.porMetodo.map((m) => m.metodo)).toEqual(["Culqi · Tarjeta", "Culqi · Yape", "Yape"]);
  });

  it("filtrado por curso muestra el curso aunque no tenga inscripciones", async () => {
    responder({ cursos: { data: [{ id: "c3", titulo: "Sin inscritos", modalidad: "VIRTUAL", cupo_maximo: 10 }] }, inscripciones: { data: null }, perfiles: { count: null } });
    const r = await generarReporte("2026-01-01", "2026-01-31", "c3");
    expect(entorno.servidor.de("cursos")[0].filtros).toContainEqual(["eq", "id", "c3"]);
    expect(entorno.servidor.de("inscripciones")[0].filtros).toContainEqual(["eq", "curso_id", "c3"]);
    expect(r.curso).toBe("Sin inscritos");
    expect(r.porCurso).toHaveLength(1);
    expect(r.usuarios.registrados).toBe(0);
  });

  it("rango por defecto y nombre del mes", () => {
    expect(rangoPorDefecto("2026-10-01")).toEqual({ desde: "2026-01-01", hasta: "2026-10-01" });
    expect(etiquetaMes("2026-09")).toMatch(/set.*2026/);
  });

  it("exporta el reporte a Excel (4 hojas) y PDF", async () => {
    preparar();
    const r = await generarReporte("2026-08-01", "2026-09-30");
    const xlsx = leerXlsx(await reporteAExcel(r));
    expect(xlsx.hojas).toEqual(["Resumen", "Por curso", "Por método de pago", "Por mes"]);
    expect(xlsx.hoja("Por curso")[4].slice(0, 7)).toEqual(["Excel", "Virtual", "30", "3", "2", "0.1", "324"]);
    expect(xlsx.hoja("Por método de pago")[4]).toEqual(["Yape", "480", expect.stringMatching(/^0\.769/)]);

    const { texto } = await leerPdf(await reporteAPdf(r));
    for (const dato of ["Reporte de inscripciones e ingresos", "Inscripciones e ingresos por curso", "Power BI", "Ticket promedio"]) expect(texto).toContain(dato);
    expect(texto.replace(/ /g, " ")).toContain("S/ 624.00");
  });
});

describe("catálogo público (HU-05 · HU-06 · HU-33)", () => {
  const curso = (id: string, extra: Record<string, unknown> = {}) => ({
    id,
    slug: id,
    titulo: `Curso ${id}`,
    descripcion: null,
    imagen_url: null,
    nivel: "BASICO",
    modalidad: "VIRTUAL",
    precio: "100.00",
    duracion_horas: 10,
    cupo_maximo: 20,
    destacado: false,
    instructor_id: "ins-1",
    sesiones: [],
    categoria: { nombre: "Ofimática", slug: "ofimatica" },
    ...extra,
  });

  it("lista los publicados con instructor, cupo libre y próxima sesión", async () => {
    vi.useFakeTimers({ now: new Date("2026-10-01T15:00:00Z") });
    responder({
      cursos: {
        data: [
          curso("excel", { precio: "180.00", descripcion: "Fórmulas y tablas dinámicas", sesiones: [{ fecha: "2026-09-20", hora_inicio: "19:00" }, { fecha: "2026-10-09", hora_inicio: "19:00" }, { fecha: "2026-10-05", hora_inicio: "09:00" }] }),
          curso("sst", { precio: "90.00", instructor_id: null, categoria: null }),
        ],
      },
      "rpc:instructores_publicos": { data: [{ id: "ins-1", nombres: "Luis", apellidos: "Ramos" }] },
      "rpc:cupo_disponible": (c) => ({ data: (c.valores as { p_curso: string }).p_curso === "excel" ? 4 : null }),
    });
    const [excel, sst] = await listarCursosPublicados({ categorias: ["ofimatica"], niveles: ["BASICO"], modalidades: ["VIRTUAL"], precioMax: 200, destacados: true });
    expect(entorno.servidor.de("cursos")[0].columnas).toContain("categoria:categorias!inner(nombre, slug)");
    expect(entorno.servidor.de("cursos")[0].filtros).toEqual(
      expect.arrayContaining([["eq", "estado", "PUBLICADO"], ["in", "categoria.slug", ["ofimatica"]], ["lte", "precio", 200], ["eq", "destacado", true]]),
    );
    expect(entorno.servidor.de("rpc:instructores_publicos")[0].valores).toEqual({ p_ids: ["ins-1"] });
    expect(excel).toMatchObject({ precio: 180, instructor: "Luis Ramos", cupo_disponible: 4, proxima_sesion: { fecha: "2026-10-05", hora_inicio: "09:00" } });
    expect(sst).toMatchObject({ instructor: null, cupo_disponible: 20, proxima_sesion: null, categoria: null });
  });

  it("busca sin tildes por título, descripción, instructor o categoría, y ordena", async () => {
    const cursos = { data: [curso("a", { titulo: "Gestión pública", precio: "300" }), curso("b", { titulo: "Excel", precio: "100", sesiones: [{ fecha: "2999-01-01", hora_inicio: "08:00" }] }), curso("c", { titulo: "Power BI", precio: "200" })] };
    const conCatalogo = () => responder({ cursos, "rpc:instructores_publicos": { data: [{ id: "ins-1", nombres: "Luis", apellidos: "Ramos" }] } });

    conCatalogo();
    expect((await listarCursosPublicados({ q: "GESTION" })).map((c) => c.slug)).toEqual(["a"]);
    expect(entorno.servidor.de("cursos")[0].columnas).toContain("categoria:categorias(nombre, slug)");
    conCatalogo();
    expect((await listarCursosPublicados({ q: "ramos" })).length).toBe(3);
    conCatalogo();
    expect((await listarCursosPublicados({ orden: "precio-asc" })).map((c) => c.slug)).toEqual(["b", "c", "a"]);
    conCatalogo();
    expect((await listarCursosPublicados({ orden: "precio-desc", limite: 2 })).map((c) => c.slug)).toEqual(["a", "c"]);
    conCatalogo();
    expect((await listarCursosPublicados({ orden: "inicio" }))[0].slug).toBe("b");

    responder({ cursos: { error: { message: "caído" } } });
    await expect(listarCursosPublicados()).rejects.toThrow("Catálogo: caído");
  });

  it("muestra el detalle de un curso publicado con módulos y sesiones en orden", async () => {
    responder({
      cursos: { data: curso("excel", { modulos: [{ id: 2, titulo: "B", orden: 2 }, { id: 1, titulo: "A", orden: 1 }], sesiones: [{ id: 2, fecha: "2026-10-09", hora_inicio: "19:00" }, { id: 1, fecha: "2026-10-02", hora_inicio: "19:00" }] }) },
      "rpc:cupo_disponible": { data: 0 },
      "rpc:instructores_publicos": { data: { nombres: "Luis", apellidos: "Ramos", especialidad: "Excel", avatar_url: null } },
    });
    const detalle = await obtenerCursoPorSlug("excel");
    expect(entorno.servidor.de("cursos")[0].filtros).toEqual([
      ["eq", "slug", "excel"],
      ["eq", "estado", "PUBLICADO"],
    ]);
    expect(detalle).toMatchObject({ precio: 100, cupo_disponible: 0, instructor: { especialidad: "Excel" } });
    expect(detalle!.modulos.map((m) => m.id)).toEqual([1, 2]);
    expect(detalle!.sesiones.map((s) => s.id)).toEqual([1, 2]);

    responder({ cursos: { data: curso("x", { instructor_id: null, modulos: null, sesiones: null }) } });
    await expect(obtenerCursoPorSlug("x")).resolves.toMatchObject({ instructor: null, cupo_disponible: 0, modulos: [], sesiones: [] });
    responder();
    await expect(obtenerCursoPorSlug("no-existe")).resolves.toBeNull();
    responder({ cursos: { error: { message: "caído" } } });
    await expect(obtenerCursoPorSlug("x")).rejects.toThrow("Curso: caído");
  });

  it("lista las categorías", async () => {
    responder({ categorias: { data: [{ id: 1, nombre: "Ofimática" }] } });
    await expect(listarCategorias()).resolves.toEqual([{ id: 1, nombre: "Ofimática" }]);
    responder();
    await expect(listarCategorias()).resolves.toEqual([]);
  });
});
