import { describe, expect, it, vi } from "vitest";
import {
  alternarCupon,
  alternarUsuario,
  cambiarEstadoCurso,
  cambiarRol,
  crearCupon,
  duplicarCurso,
  eliminarCategoria,
  eliminarCurso,
  emitirCertificados,
  guardarCategoria,
  guardarCurso,
  invitarUsuario,
  observarPago,
  resolverPago,
  resolverReembolso,
} from "@/features/administracion/acciones";
import { confirmarPago } from "@/features/matricula/confirmar-pago";
import { requireRol } from "@/lib/auth";
import { conSesion, ejecutarTareas, entorno, formulario, Redireccion, responder, UUID } from "../../apoyo/entorno";

vi.mock("@/lib/auth", () => import("../../apoyo/auth-falso"));
vi.mock("@/features/matricula/confirmar-pago", () => ({ confirmarPago: vi.fn(async () => "CONFIRMADO") }));

const auditadas = () => entorno.admin.de("registro_actividad").map((c) => (c.valores as { accion: string }).accion);

describe("solo el administrador", () => {
  it("puede ejecutar las acciones de administración", async () => {
    conSesion("instructor");
    await expect(resolverPago(formulario({ inscripcionId: UUID.inscripcion, decision: "aprobar" }))).rejects.toEqual(new Redireccion("/instructor"));
    expect(requireRol).toHaveBeenCalledWith("administrador");
    expect(entorno.admin.consultas).toHaveLength(0);
  });
});

describe("cursos (HU-04 · HU-56 · HU-57)", () => {
  const curso = (extra: Record<string, string> = {}) =>
    // Los mismos campos que envía DialogoCurso (los vacíos llegan como "").
    formulario({ id: "", titulo: "Excel Avanzado", descripcion: "", categoriaId: "3", instructorId: UUID.instructor, nivel: "AVANZADO", modalidad: "VIRTUAL", precio: "180", cupo: "25", horas: "24", estado: "PUBLICADO", publicarEn: "", imagen: "", ...extra });

  it("valida los datos", async () => {
    conSesion("administrador");
    await expect(guardarCurso({}, curso({ cupo: "0" }))).resolves.toEqual({ ok: false, mensaje: "El cupo debe ser al menos 1" });
    await expect(guardarCurso({}, curso({ imagen: "portada.png" }))).resolves.toEqual({ ok: false, mensaje: "La imagen debe ser una URL" });
  });

  it("crea el curso con un slug único y la publicación programada en hora de Perú", async () => {
    conSesion("administrador");
    responder({ "cursos.select": [{ data: { id: "otro" } }, { data: null }] });
    await expect(guardarCurso({}, curso({ destacado: "on", publicarEn: "2026-10-05T08:00" }))).resolves.toEqual({ ok: true, mensaje: "Curso creado" });
    expect(entorno.servidor.de("cursos", "select").map((c) => c.filtros[0])).toEqual([
      ["eq", "slug", "excel-avanzado"],
      ["eq", "slug", "excel-avanzado-2"],
    ]);
    expect(entorno.servidor.de("cursos", "insert")[0].valores).toMatchObject({
      slug: "excel-avanzado-2",
      categoria_id: 3,
      precio: 180,
      cupo_maximo: 25,
      destacado: true,
      publicar_en: "2026-10-05T13:00:00.000Z",
      imagen_url: null,
    });
    expect(auditadas()).toEqual(["CREAR_CURSO"]);
  });

  it("edita sin cambiar el slug e informa los errores", async () => {
    conSesion("administrador");
    responder({ "cursos.update": [{}, { error: { message: "violación de check" } }] });
    await expect(guardarCurso({}, curso({ id: UUID.curso, categoriaId: "" }))).resolves.toEqual({ ok: true, mensaje: "Curso actualizado" });
    const edicion = entorno.servidor.de("cursos", "update")[0];
    expect(edicion.valores).not.toHaveProperty("slug");
    expect(edicion.valores).toMatchObject({ categoria_id: null, destacado: false, publicar_en: null });
    expect(edicion.filtros).toContainEqual(["eq", "id", UUID.curso]);
    await expect(guardarCurso({}, curso({ id: UUID.curso }))).resolves.toEqual({ ok: false, mensaje: "No se pudo guardar: violación de check" });
  });

  it("publica, despublica y elimina solo cursos sin inscripciones", async () => {
    conSesion("administrador");
    responder({ "cursos.delete": [{ error: { code: "23503", message: "fk" } }, {}] });
    await cambiarEstadoCurso(formulario({ id: UUID.curso, estado: "PUBLICADO" }));
    await cambiarEstadoCurso(formulario({ id: UUID.curso, estado: "DESPUBLICADO" }));
    await expect(eliminarCurso(formulario({ id: UUID.curso }))).resolves.toEqual({ ok: false, mensaje: "El curso tiene inscripciones; despublícalo en lugar de eliminarlo." });
    await expect(eliminarCurso(formulario({ id: UUID.curso }))).resolves.toEqual({ ok: true, mensaje: "Curso eliminado" });
    expect(auditadas()).toEqual(["PUBLICAR_CURSO", "DESPUBLICAR_CURSO", "ELIMINAR_CURSO"]);
  });

  it("duplica el curso y sus módulos como borrador", async () => {
    conSesion("administrador");
    const original = { titulo: "Excel", precio: 180, cupo_maximo: 30, modulos: [{ titulo: "Fórmulas", orden: 1 }, { titulo: "Tablas", orden: 2 }] };
    responder({ "cursos.select": [{ data: original }, { data: null }], "cursos.insert": { data: { id: UUID.otra } } });
    await duplicarCurso(formulario({ id: UUID.curso }));
    expect(entorno.servidor.de("cursos", "insert")[0].valores).toEqual({ titulo: "Excel (copia)", precio: 180, cupo_maximo: 30, slug: "excel-copia", estado: "BORRADOR", destacado: false });
    expect(entorno.servidor.de("modulos", "insert")[0].valores).toEqual([
      { titulo: "Fórmulas", orden: 1, curso_id: UUID.otra },
      { titulo: "Tablas", orden: 2, curso_id: UUID.otra },
    ]);
    expect(auditadas()).toEqual(["DUPLICAR_CURSO"]);

    responder();
    await duplicarCurso(formulario({ id: UUID.curso }));
    expect(entorno.servidor.de("cursos", "insert")).toHaveLength(0);
  });
});

describe("categorías (HU-18)", () => {
  it("guarda con slug, informa nombres repetidos y elimina", async () => {
    conSesion("administrador");
    responder({ "categorias.insert": [{}, { error: { code: "23505", message: "dup" } }], "categorias.update": { error: { message: "x" } } });
    await expect(guardarCategoria({}, formulario({ id: "", nombre: "Seguridad y Salud", descripcion: "" }))).resolves.toEqual({ ok: true, mensaje: "Categoría guardada" });
    expect(entorno.servidor.de("categorias", "insert")[0].valores).toEqual({ nombre: "Seguridad y Salud", slug: "seguridad-y-salud", descripcion: null });
    await expect(guardarCategoria({}, formulario({ id: "", nombre: "Seguridad y Salud" }))).resolves.toEqual({ ok: false, mensaje: "Ya existe una categoría con ese nombre" });
    await expect(guardarCategoria({}, formulario({ id: "4", nombre: "Ofimática" }))).resolves.toEqual({ ok: false, mensaje: "x" });
    await expect(guardarCategoria({}, formulario({ id: "", nombre: "TI" }))).resolves.toEqual({ ok: false, mensaje: "Escribe el nombre" });
    await eliminarCategoria(formulario({ id: "4" }));
    expect(entorno.servidor.de("categorias", "delete")[0].filtros).toContainEqual(["eq", "id", 4]);
  });
});

describe("validación de pagos (CU «Validar comprobantes»)", () => {
  const inscripcion = (estado = "PENDIENTE", extra = {}) => ({
    data: {
      id: UUID.inscripcion,
      codigo: "MAT-AB12CD34",
      estado,
      estudiante_id: UUID.estudiante,
      estudiante: { nombres: "Ana", correo: "ana@pedsar.test" },
      curso: { titulo: "Excel", slug: "excel" },
      pagos: [{ id: UUID.pago, estado: "PENDIENTE", numero_operacion: "00123456" }],
      ...extra,
    },
  });

  it("confirmar delega en confirmarPago, con el administrador como responsable", async () => {
    conSesion("administrador");
    responder({}, { "inscripciones.select": inscripcion() });
    await resolverPago(formulario({ inscripcionId: UUID.inscripcion, decision: "aprobar" }));
    expect(confirmarPago).toHaveBeenCalledWith(UUID.pago, { actor: UUID.admin });
    expect(entorno.admin.de("pagos", "update")).toHaveLength(0);
    expect(entorno.admin.de("inscripciones", "update")).toHaveLength(0);
  });

  it("rechazar cancela la matrícula y libera el cupo", async () => {
    conSesion("administrador");
    responder({}, { "inscripciones.select": inscripcion() });
    await resolverPago(formulario({ inscripcionId: UUID.inscripcion, decision: "rechazar" }));
    expect(entorno.admin.de("pagos", "update")[0].valores).toEqual({ estado: "RECHAZADO", fecha_pago: null });
    expect(entorno.admin.de("inscripciones", "update")[0].valores).toEqual({ estado: "CANCELADA" });
    expect(entorno.admin.de("notificaciones")[0].valores).toMatchObject({ enlace: "/estudiante/pagos" });
    expect(auditadas()).toEqual(["RECHAZAR_PAGO"]);
    expect(entorno.tareas).toHaveLength(1);
  });

  it("no resuelve dos veces la misma inscripción (ni duplica correos)", async () => {
    conSesion("administrador");
    responder({}, { "inscripciones.select": inscripcion("CONFIRMADA") });
    await resolverPago(formulario({ inscripcionId: UUID.inscripcion, decision: "aprobar" }));
    expect(entorno.admin.de("pagos")).toHaveLength(0);
    expect(confirmarPago).not.toHaveBeenCalled();
    expect(entorno.tareas).toHaveLength(0);
  });

  it("observar devuelve el pago para corregir y renueva el plazo de 48 h", async () => {
    vi.useFakeTimers({ now: new Date("2026-10-01T15:00:00Z") });
    conSesion("administrador");
    responder({}, { "inscripciones.select": inscripcion() });
    await expect(observarPago({}, formulario({ inscripcionId: UUID.inscripcion, motivo: "La captura no muestra el N.º de operación" }))).resolves.toEqual({
      ok: true,
      mensaje: "Pago devuelto al estudiante para corrección",
    });
    expect(entorno.admin.de("pagos", "update")[0].valores).toEqual({ observacion: "La captura no muestra el N.º de operación", numero_operacion: null, voucher_ruta: null, reportado_en: null });
    expect(entorno.admin.de("inscripciones", "update")[0].valores).toEqual({ vence_en: "2026-10-03T15:00:00.000Z" });
    expect(entorno.admin.de("notificaciones")[0].valores).toMatchObject({ mensaje: expect.stringContaining("La captura no muestra el N.º de operación") });
    expect(entorno.admin.de("registro_actividad")[0].valores).toMatchObject({ accion: "OBSERVAR_PAGO", detalle: { numero_operacion: "00123456" } });
    expect(entorno.tareas).toHaveLength(1);
  });

  it("no observa sin motivo, ni pagos que ya no están pendientes", async () => {
    conSesion("administrador");
    await expect(observarPago({}, formulario({ inscripcionId: UUID.inscripcion, motivo: "no" }))).resolves.toEqual({ ok: false, mensaje: "Indica qué debe corregir el estudiante" });
    responder({}, { "inscripciones.select": inscripcion("CANCELADA") });
    await expect(observarPago({}, formulario({ inscripcionId: UUID.inscripcion, motivo: "Captura borrosa" }))).resolves.toEqual({ ok: false, mensaje: "El pago ya no está pendiente" });
    responder({}, { "inscripciones.select": inscripcion(), "pagos.update": { error: { message: "fallo" } } });
    await expect(observarPago({}, formulario({ inscripcionId: UUID.inscripcion, motivo: "Captura borrosa" }))).resolves.toEqual({ ok: false, mensaje: "fallo" });
    expect(entorno.admin.de("inscripciones", "update")).toHaveLength(0);
  });
});

describe("reembolsos (HU-31)", () => {
  const reembolso = { data: { id: 9, pago: { id: UUID.pago, inscripcion_id: UUID.inscripcion, inscripcion: { estudiante_id: UUID.estudiante } } } };

  it("aprobar reembolsa el pago y cancela la matrícula", async () => {
    conSesion("administrador");
    responder({}, { "reembolsos.select": reembolso });
    await resolverReembolso(formulario({ id: "9", decision: "aprobar" }));
    expect(entorno.admin.de("reembolsos", "update")[0].valores).toEqual({ estado: "APROBADO" });
    expect(entorno.admin.de("pagos", "update")[0].valores).toEqual({ estado: "REEMBOLSADO" });
    expect(entorno.admin.de("inscripciones", "update")[0].valores).toEqual({ estado: "CANCELADA" });
    expect(entorno.admin.de("notificaciones")[0].valores).toMatchObject({ mensaje: "Tu solicitud de reembolso fue aprobada." });
    expect(auditadas()).toEqual(["APROBAR_REEMBOLSO"]);
  });

  it("rechazar solo cambia la solicitud; uno inexistente no hace nada", async () => {
    conSesion("administrador");
    responder({}, { "reembolsos.select": reembolso });
    await resolverReembolso(formulario({ id: "9", decision: "rechazar" }));
    expect(entorno.admin.de("pagos")).toHaveLength(0);
    expect(entorno.admin.de("notificaciones")[0].valores).toMatchObject({ mensaje: "Tu solicitud de reembolso fue rechazada." });
    responder();
    await resolverReembolso(formulario({ id: "9", decision: "aprobar" }));
    expect(entorno.admin.de("reembolsos", "update")).toHaveLength(0);
  });
});

describe("cupones (HU-32)", () => {
  it("crea cupones válidos y únicos, y los activa o desactiva", async () => {
    conSesion("administrador");
    responder({ "cupones.insert": [{}, { error: { code: "23505", message: "dup" } }, { error: { message: "otro" } }] });
    const cupon = { codigo: " promo20 ", porcentaje: "20", vigencia: "2026-12-31", usos: "" };
    await expect(crearCupon({}, formulario(cupon))).resolves.toEqual({ ok: true, mensaje: "Cupón PROMO20 creado" });
    expect(entorno.servidor.de("cupones", "insert")[0].valores).toEqual({ codigo: "PROMO20", porcentaje_descuento: 20, fecha_vigencia: "2026-12-31", usos_maximos: null });
    await expect(crearCupon({}, formulario(cupon))).resolves.toEqual({ ok: false, mensaje: "Ese código ya existe" });
    await expect(crearCupon({}, formulario(cupon))).resolves.toEqual({ ok: false, mensaje: "otro" });
    await expect(crearCupon({}, formulario({ ...cupon, codigo: "a b" }))).resolves.toMatchObject({ ok: false, mensaje: expect.stringMatching(/4 a 20/) });
    await alternarCupon(formulario({ id: "7", activo: "false" }));
    expect(entorno.servidor.de("cupones", "update")[0]).toMatchObject({ valores: { activo: false }, filtros: [["eq", "id", 7]] });
  });
});

describe("emisión de certificados (HU-11)", () => {
  const ID_2 = "88888888-8888-4888-8888-888888888888";
  const fila = (id: string, nombres: string) => ({
    id,
    estudiante_id: UUID.estudiante,
    estudiante: { nombres, apellidos: "Quispe", correo: `${nombres.toLowerCase()}@pedsar.test` },
    curso: { titulo: "Excel", duracion_horas: 24, instructor: { nombres: "Luis", apellidos: "Ramos" } },
  });
  const resultado = (id: string, nota: number, asistencia: number) => ({
    inscripcion_id: id,
    evaluaciones: 2,
    rendidas: 2,
    nota_final: nota,
    sesiones: 4,
    presentes: 3,
    asistencia,
    contenidos: 0,
    completados: 0,
    progreso: null,
  });
  const preparar = () =>
    responder({
      "inscripciones.select": { data: [fila(UUID.inscripcion, "Ana"), fila(ID_2, "Beto")] },
      "rpc:resultado_academico": { data: [resultado(UUID.inscripcion, 15.5, 100), resultado(ID_2, 11, 50)] },
    });

  it("pide seleccionar estudiantes", async () => {
    conSesion("administrador");
    await expect(emitirCertificados(formulario({}))).resolves.toEqual({ ok: false, mensaje: "Selecciona al menos un estudiante" });
  });

  it("emite solo a quien cumple los requisitos y congela sus datos", async () => {
    conSesion("administrador");
    preparar();
    const r = await emitirCertificados(formulario({ inscripcion: [UUID.inscripcion, ID_2] }));
    expect(entorno.servidor.de("inscripciones")[0].filtros).toEqual([
      ["in", "id", [UUID.inscripcion, ID_2]],
      ["eq", "estado", "CONFIRMADA"],
    ]);
    const emitidos = entorno.servidor.de("certificados", "insert");
    expect(emitidos).toHaveLength(1);
    expect(emitidos[0].valores).toEqual({
      inscripcion_id: UUID.inscripcion,
      codigo_unico: expect.stringMatching(/^PED-\d{4}-[A-Z2-9]{8}$/),
      estudiante_nombre: "Ana Quispe",
      curso_titulo: "Excel",
      duracion_horas: 24,
      instructor_nombre: "Luis Ramos",
      nota_final: 15.5,
      asistencia: 100,
      motivo_excepcion: null,
    });
    expect(r.ok).toBe(true);
    expect(r.mensaje).toBe(
      "1 certificado(s) emitido(s). 1 sin emitir por no cumplir los requisitos — Beto Quispe: Nota final 11.0/20 (mínimo 13); Asistencia 50 % (mínimo 75 %)",
    );
    expect(auditadas()).toEqual(["EMITIR_CERTIFICADO"]);
    expect(entorno.admin.de("notificaciones")).toHaveLength(1);
    expect(entorno.tareas).toHaveLength(1);
  });

  it("con un motivo, emite como excepción y lo deja en el certificado y la auditoría", async () => {
    conSesion("administrador");
    preparar();
    const motivo = "Faltas justificadas por descanso médico";
    const r = await emitirCertificados(formulario({ inscripcion: [UUID.inscripcion, ID_2], motivo }));
    expect(r).toEqual({ ok: true, mensaje: "2 certificado(s) emitido(s) (1 como excepción)" });
    expect((entorno.servidor.de("certificados", "insert")[1].valores as { motivo_excepcion: string }).motivo_excepcion).toBe(motivo);
    expect(auditadas()).toEqual(["EMITIR_CERTIFICADO", "EMITIR_CERTIFICADO_EXCEPCION"]);
    expect(entorno.admin.de("registro_actividad")[1].valores).toMatchObject({ detalle: { motivo, requisitos_no_cumplidos: expect.any(Array) } });
  });

  it("exige un motivo suficiente y no duplica certificados ya emitidos", async () => {
    conSesion("administrador");
    await expect(emitirCertificados(formulario({ inscripcion: [ID_2], motivo: "porque sí" }))).resolves.toMatchObject({ ok: false, mensaje: expect.stringMatching(/mínimo 10/) });
    preparar();
    entorno.servidor = (await import("../../apoyo/supabase-falso")).supabaseFalso({
      "inscripciones.select": { data: [fila(UUID.inscripcion, "Ana")] },
      "rpc:resultado_academico": { data: [resultado(UUID.inscripcion, 15.5, 100)] },
      "certificados.insert": { error: { code: "23505", message: "duplicado" } },
    });
    await expect(emitirCertificados(formulario({ inscripcion: [UUID.inscripcion] }))).resolves.toEqual({ ok: false, mensaje: "No se emitió ningún certificado" });
    expect(entorno.tareas).toHaveLength(0);
  });
});

describe("usuarios y roles (HU-03 · HU-34)", () => {
  it("cambia el rol o el estado de otros usuarios, nunca los propios", async () => {
    conSesion("administrador");
    await cambiarRol(formulario({ id: UUID.admin, rol: "estudiante" }));
    await alternarUsuario(formulario({ id: UUID.admin, estado: "false" }));
    expect(entorno.servidor.consultas).toHaveLength(0);

    await cambiarRol(formulario({ id: UUID.instructor, rol: "instructor" }));
    await alternarUsuario(formulario({ id: UUID.instructor, estado: "false" }));
    await alternarUsuario(formulario({ id: UUID.instructor, estado: "true" }));
    expect(entorno.servidor.de("perfiles", "update").map((c) => c.valores)).toEqual([{ rol: "instructor" }, { estado: false }, { estado: true }]);
    expect(auditadas()).toEqual(["CAMBIAR_ROL", "DESACTIVAR_USUARIO", "ACTIVAR_USUARIO"]);
  });

  it("invita usuarios con el rol elegido", async () => {
    conSesion("administrador");
    const datos = { nombres: "Luis", apellidos: "Ramos", correo: "luis@pedsar.test", rol: "instructor", especialidad: "Ofimática" };
    await expect(invitarUsuario({}, formulario({ ...datos, correo: "no-es-correo" }))).resolves.toEqual({ ok: false, mensaje: "Correo no válido" });
    await expect(invitarUsuario({}, formulario(datos))).resolves.toEqual({ ok: true, mensaje: "Invitación enviada a luis@pedsar.test" });
    expect(entorno.admin.cliente.auth.admin.inviteUserByEmail).toHaveBeenCalledWith("luis@pedsar.test", {
      data: { nombres: "Luis", apellidos: "Ramos" },
      redirectTo: "https://pedsar.test/auth/confirm?next=/cuenta/nueva-contrasena",
    });
    expect(entorno.admin.de("perfiles", "update")[0]).toMatchObject({ valores: { rol: "instructor", especialidad: "Ofimática" }, filtros: [["eq", "id", "invitado"]] });

    entorno.admin.cliente.auth.admin.inviteUserByEmail.mockResolvedValueOnce({ data: { user: null }, error: { message: "ya registrado" } } as never);
    await expect(invitarUsuario({}, formulario(datos))).resolves.toEqual({ ok: false, mensaje: "ya registrado" });
  });
});
