import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireRol } from "@/lib/auth";
import { inscribirse, registrarPagoManual, validarCupon } from "@/features/matricula/acciones";
import { confirmarPago } from "@/features/matricula/confirmar-pago";
import { conSesion, ejecutarTareas, entorno, formulario, Redireccion, responder, UUID } from "../../apoyo/entorno";

vi.mock("@/lib/auth", () => import("../../apoyo/auth-falso"));

const disponibilidad = vi.hoisted(() => ({ pasarela: true, manual: true }));
vi.mock("@/lib/pagos", async (original) => ({
  ...(await original<typeof import("@/lib/pagos")>()),
  pasarelaActiva: () => disponibilidad.pasarela,
  pagoManualHabilitado: () => disponibilidad.manual,
}));
beforeEach(() => Object.assign(disponibilidad, { pasarela: true, manual: true }));
vi.mock("@/features/matricula/confirmar-pago", () => ({ confirmarPago: vi.fn(async () => "CONFIRMADO") }));

const CUPON_VIGENTE = { id: 7, porcentaje_descuento: "20.00", fecha_vigencia: "2999-12-31", usos_maximos: null, activo: true };

describe("cupones de descuento (HU-32)", () => {
  it("cuenta solo pagos aprobados y reservas pendientes vigentes", async () => {
    conSesion("estudiante");
    responder({}, { cupones: { data: { ...CUPON_VIGENTE, usos_maximos: 10 } }, "pagos.select": [{ count: 7 }, { count: 2 }] });
    await expect(validarCupon("PROMO20")).resolves.toMatchObject({ ok: true });
    expect(entorno.admin.de("pagos")[0].filtros).toContainEqual(["eq", "estado", "APROBADO"]);
    expect(entorno.admin.de("pagos")[1].filtros).toContainEqual(["eq", "inscripcion.estado", "PENDIENTE"]);
    expect(entorno.admin.de("pagos")[1].filtros).toContainEqual(["or", expect.stringContaining("vence_en.gt."), { referencedTable: "inscripcion" }]);
  });

  it("solo los estudiantes validan cupones", async () => {
    conSesion("instructor");
    await expect(validarCupon("PROMO")).rejects.toBeInstanceOf(Redireccion);
    expect(requireRol).toHaveBeenCalledWith("estudiante");
  });

  it("acepta un cupón vigente (sin importar mayúsculas ni espacios)", async () => {
    conSesion("estudiante");
    responder({}, { cupones: { data: CUPON_VIGENTE } });
    await expect(validarCupon("  promo20 ")).resolves.toEqual({ ok: true, mensaje: "Cupón aplicado: 20 % de descuento", porcentaje: 20 });
    expect(entorno.admin.de("cupones")[0].filtros).toContainEqual(["eq", "codigo", "PROMO20"]);
  });

  it.each([
    ["inexistente", null],
    ["inactivo", { ...CUPON_VIGENTE, activo: false }],
    ["vencido", { ...CUPON_VIGENTE, fecha_vigencia: "2020-01-01" }],
  ])("rechaza un cupón %s", async (_, cupon) => {
    conSesion("estudiante");
    responder({}, { cupones: { data: cupon } });
    await expect(validarCupon("PROMO20")).resolves.toEqual({ ok: false, mensaje: "Cupón no válido o vencido" });
  });

  it("rechaza un cupón que agotó sus usos y pide escribir uno", async () => {
    conSesion("estudiante");
    responder({}, { cupones: { data: { ...CUPON_VIGENTE, usos_maximos: 10 } }, "pagos.select": { count: 10 } });
    await expect(validarCupon("PROMO20")).resolves.toMatchObject({ ok: false });
    expect(entorno.admin.de("pagos")[0].filtros).toContainEqual(["eq", "cupon_id", 7]);
    await expect(validarCupon("  ")).resolves.toEqual({ ok: false, mensaje: "Ingresa un cupón" });
  });
});

describe("matrícula y pago atómicos", () => {
  const datos = (extra: Record<string, string> = {}) => formulario({ cursoId: UUID.curso, metodo: "YAPE", ...extra });
  const curso = { data: { id: UUID.curso, titulo: "Excel avanzado", precio: 180, slug: "excel-avanzado" } };
  const matricula = { data: { inscripcion_id: UUID.inscripcion, codigo: "MAT-AB12CD34", vence_en: "2026-11-12T15:00:00Z", pago_id: UUID.pago, monto: 180, cupon_id: null } };
  it("crea ambos registros mediante una sola transacción y después notifica", async () => {
    conSesion("estudiante");
    responder({ cursos: curso }, { "rpc:registrar_matricula": matricula });
    await expect(inscribirse(datos({ metodo: "CULQI", comprobante: "FACTURA", ruc: "20605615521", razonSocial: "Empresa SAC" }))).rejects.toEqual(new Redireccion("/estudiante/pagos?pagar=MAT-AB12CD34"));
    expect(entorno.admin.de("rpc:registrar_matricula")[0].valores).toEqual({ p_estudiante: UUID.estudiante, p_curso: UUID.curso, p_metodo: "CULQI", p_cupon: "", p_monto: 180, p_facturacion: { tipo: "FACTURA", ruc: "20605615521", razon_social: "Empresa SAC" } });
    expect(entorno.servidor.de("inscripciones", "insert")).toHaveLength(0);
    expect(entorno.admin.de("pagos", "insert")).toHaveLength(0);
    await ejecutarTareas();
    expect(console.info).toHaveBeenCalledWith(expect.stringContaining("Completa el pago"));
  });
  it.each([["P0001", "El curso ya no tiene cupos disponibles"], ["23505", "Ya estás inscrito en este curso"], ["22023", "El precio cambió"], ["XX000", "No se pudo registrar la matrícula y su pago. Inténtalo de nuevo."]])("no envía confirmación si falla la transacción: %s", async (code, mensaje) => {
    conSesion("estudiante");
    responder({ cursos: curso }, { "rpc:registrar_matricula": { error: { code, message: "El precio cambió" } } });
    await expect(inscribirse(datos())).rejects.toEqual(new Redireccion(`/estudiante/cursos?error=${encodeURIComponent(mensaje)}`));
    expect(entorno.tareas).toHaveLength(0);
    expect(entorno.admin.de("registro_actividad")).toHaveLength(0);
  });
  it("un cupón invalidado no se transforma silenciosamente en precio completo", async () => {
    conSesion("estudiante");
    responder({ cursos: curso });
    await expect(inscribirse(datos({ cupon: "PROMO20" }))).rejects.toMatchObject({ destino: expect.stringContaining("error=") });
    expect(entorno.admin.de("rpc:registrar_matricula")).toHaveLength(0);
  });
  it("transmite el descuento a validar en la BD y confirma las becas sin cobro", async () => {
    conSesion("estudiante");
    responder({ cursos: curso }, { cupones: { data: { ...CUPON_VIGENTE, porcentaje_descuento: 100 } }, "rpc:registrar_matricula": matricula });
    await expect(inscribirse(datos({ cupon: "BECA" }))).rejects.toEqual(new Redireccion("/estudiante/cursos"));
    expect(entorno.admin.de("rpc:registrar_matricula")[0].valores).toMatchObject({ p_monto: 0, p_cupon: "BECA" });
    expect(confirmarPago).toHaveBeenCalledWith(UUID.pago, { actor: UUID.estudiante });
  });
  it.each([["CULQI", "pasarela"], ["YAPE", "manual"]] as const)("rechaza %s si está deshabilitado", async (metodo, clave) => {
    conSesion("estudiante"); disponibilidad[clave] = false;
    await expect(inscribirse(datos({ metodo }))).rejects.toMatchObject({ destino: expect.stringContaining("error=") });
    expect(entorno.admin.consultas).toHaveLength(0);
  });
  it("vuelve al catálogo si no existe el curso", async () => {
    conSesion("estudiante");
    await expect(inscribirse(datos())).rejects.toEqual(new Redireccion("/cursos"));
  });
});

describe("registro del pago manual por Yape / Plin", () => {
  const futuro = new Date(Date.now() + 3600_000).toISOString();
  const pago = (extra: Record<string, unknown> = {}, inscripcion: Record<string, unknown> = {}) => ({
    data: {
      id: UUID.pago,
      metodo: "YAPE",
      estado: "PENDIENTE",
      inscripcion: { id: UUID.inscripcion, codigo: "MAT-AB12CD34", estado: "PENDIENTE", vence_en: futuro, curso: { titulo: "Excel" }, ...inscripcion },
      ...extra,
    },
  });
  const enviar = (datos: Record<string, string>) => registrarPagoManual({}, formulario({ pagoId: UUID.pago, ...datos }));

  it("valida el N.º de operación y la ruta de la captura", async () => {
    conSesion("estudiante");
    await expect(enviar({ numeroOperacion: "12" })).resolves.toMatchObject({ ok: false, mensaje: expect.stringMatching(/N\.º de operación/) });
    await expect(enviar({ numeroOperacion: "12345678", voucher: `${UUID.otra}/captura.png` })).resolves.toEqual({
      ok: false,
      mensaje: "La captura no es válida; vuelve a adjuntarla",
    });
    await expect(enviar({ numeroOperacion: "12345678", voucher: `${UUID.estudiante}/../x.png` })).resolves.toMatchObject({ ok: false });
    expect(entorno.servidor.consultas).toHaveLength(0);
  });

  it.each([
    ["no es del estudiante (RLS)", { data: null }, "No encontramos ese pago"],
    ["ya venció la reserva", pago({}, { vence_en: "2020-01-01T00:00:00Z" }), "Tu reserva venció. Vuelve a inscribirte y registra el pago en la nueva inscripción."],
    ["ya fue validado", pago({ estado: "APROBADO" }), "Este pago ya fue validado"],
    ["es de la pasarela", pago({ metodo: "CULQI" }), "Este pago se procesa por la pasarela"],
  ])("no se registra si el pago %s", async (_, respuesta, mensaje) => {
    conSesion("estudiante");
    responder({ pagos: respuesta });
    await expect(enviar({ numeroOperacion: "12345678" })).resolves.toEqual({ ok: false, mensaje });
    expect(entorno.admin.consultas).toHaveLength(0);
  });

  it("rechaza un N.º de operación ya usado en otro pago", async () => {
    conSesion("estudiante");
    responder({ pagos: pago() }, { "pagos.update": { error: { code: "23505", message: "duplicate" } } });
    await expect(enviar({ numeroOperacion: "12345678" })).resolves.toEqual({ ok: false, mensaje: "Ese N.º de operación ya fue registrado en otro pago" });
    expect(entorno.admin.de("inscripciones")).toHaveLength(0);
  });

  it("guarda la operación, detiene el vencimiento y avisa a los administradores", async () => {
    conSesion("estudiante");
    responder({ pagos: pago() }, { "perfiles.select": { data: [{ id: UUID.admin }, { id: UUID.otra }] } });
    const voucher = `${UUID.estudiante}/1727800000-captura.png`;
    await expect(enviar({ numeroOperacion: " 0012 3456 ab ", voucher })).resolves.toEqual({ ok: true, mensaje: "¡Listo! Validaremos tu pago y te avisaremos." });

    const actualizacion = entorno.admin.de("pagos", "update")[0];
    expect(actualizacion.valores).toMatchObject({ numero_operacion: "00123456AB", observacion: null, voucher_ruta: voucher, reportado_en: expect.any(String) });
    expect(actualizacion.filtros).toContainEqual(["eq", "id", UUID.pago]);
    expect(entorno.admin.de("inscripciones", "update")[0].valores).toEqual({ vence_en: null });
    expect(entorno.admin.de("perfiles")[0].filtros).toEqual([
      ["eq", "rol", "administrador"],
      ["eq", "estado", true],
    ]);
    const avisos = entorno.admin.de("notificaciones", "insert")[0].valores as { usuario_id: string; mensaje: string }[];
    expect(avisos.map((a) => a.usuario_id)).toEqual([UUID.admin, UUID.otra]);
    expect(avisos[0].mensaje).toBe("Pago por validar · Excel · Yape op. 00123456AB");
    expect(entorno.admin.de("registro_actividad")[0].valores).toMatchObject({ accion: "REPORTAR_PAGO" });
  });

  it("sin captura no borra la que ya estaba y sin administradores no notifica", async () => {
    conSesion("estudiante");
    responder({ pagos: pago() }, { "perfiles.select": { data: [] } });
    await expect(enviar({ numeroOperacion: "AB-1234", voucher: "" })).resolves.toMatchObject({ ok: true });
    expect(entorno.admin.de("pagos", "update")[0].valores).not.toHaveProperty("voucher_ruta");
    expect(entorno.admin.de("notificaciones")).toHaveLength(0);
  });
});
