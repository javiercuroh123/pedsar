import { revalidatePath } from "next/cache";
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

describe("inscripción (HU-07 · HU-12 · HU-17)", () => {
  const datos = (extra: Record<string, string> = {}) => formulario({ cursoId: UUID.curso, metodo: "YAPE", ...extra });
  const conCurso = (inscripcion: { data?: unknown; error?: { code: string; message: string } }, admin = {}) =>
    responder(
      { cursos: { data: { id: UUID.curso, titulo: "Excel avanzado", precio: "180.00", slug: "excel-avanzado" } }, "inscripciones.insert": inscripcion },
      admin,
    );
  const inscripcionCreada = { data: { id: UUID.inscripcion, codigo: "MAT-AB12CD34", vence_en: "2026-10-03T15:00:00Z" } };

  it("solo acepta el pago en línea (Culqi) o el directo por Yape o Plin", async () => {
    conSesion("estudiante");
    await expect(inscribirse(datos({ metodo: "TARJETA" }))).rejects.toThrow();
  });

  it("con pago en línea guarda los datos de facturación, avisa por correo y lleva a pagar", async () => {
    conSesion("estudiante", { nombres: "Ana" });
    conCurso(inscripcionCreada);
    await expect(inscribirse(datos({ metodo: "CULQI", comprobante: "FACTURA", ruc: "20605615521", razonSocial: "Empresa SAC" }))).rejects.toEqual(
      new Redireccion("/estudiante/pagos?pagar=MAT-AB12CD34"),
    );
    expect(entorno.admin.de("pagos", "insert")[0].valores).toEqual({
      inscripcion_id: UUID.inscripcion,
      cupon_id: null,
      monto: 180,
      metodo: "CULQI",
      datos_facturacion: { tipo: "FACTURA", ruc: "20605615521", razon_social: "Empresa SAC" },
    });
    await ejecutarTareas();
    expect(console.info).toHaveBeenCalledWith(expect.stringMatching(/estudiante@pedsar\.test: Completa el pago .*Excel avanzado/));
  });

  it.each([
    ["CULQI", "pasarela", "El pago en línea aún no está disponible"],
    ["YAPE", "manual", "El pago directo por Yape o Plin no está disponible"],
  ] as const)("no acepta %s si ese medio está apagado", async (metodo, apagado, mensaje) => {
    disponibilidad[apagado] = false;
    conSesion("estudiante");
    conCurso(inscripcionCreada);
    await expect(inscribirse(datos({ metodo }))).rejects.toEqual(new Redireccion(`/estudiante/cursos?error=${encodeURIComponent(mensaje)}`));
    expect(entorno.servidor.de("inscripciones")).toHaveLength(0);
  });

  it("si el curso no existe, vuelve al catálogo", async () => {
    conSesion("estudiante");
    await expect(inscribirse(datos())).rejects.toEqual(new Redireccion("/cursos"));
  });

  it.each([
    ["23505", "Ya estás inscrito en este curso"],
    ["P0001", "El curso ya no tiene cupos disponibles"],
    ["42501", "permiso denegado"],
  ])("traduce el error %s de la BD", async (code, mensaje) => {
    conSesion("estudiante");
    conCurso({ error: { code, message: "permiso denegado" } });
    await expect(inscribirse(datos())).rejects.toEqual(new Redireccion(`/estudiante/cursos?error=${encodeURIComponent(mensaje)}`));
    expect(entorno.admin.de("pagos")).toHaveLength(0);
  });

  it("crea la inscripción y su pago con el descuento, audita y envía las instrucciones de pago", async () => {
    conSesion("estudiante", { nombres: "Ana" });
    conCurso(inscripcionCreada, { cupones: { data: CUPON_VIGENTE } });
    await expect(inscribirse(datos({ cupon: "promo20", telefono: "987654321", documento: "45678912" }))).rejects.toEqual(
      new Redireccion("/estudiante/pagos?inscripcion=MAT-AB12CD34"),
    );

    expect(entorno.servidor.de("perfiles", "update")[0].valores).toEqual({ telefono: "987654321", documento: "45678912" });
    // El estudiante solo inserta su inscripción; el pago lo escribe el servidor.
    expect(entorno.servidor.de("inscripciones", "insert")[0].valores).toEqual({ estudiante_id: UUID.estudiante, curso_id: UUID.curso });
    expect(entorno.admin.de("pagos", "insert")[0].valores).toEqual({ inscripcion_id: UUID.inscripcion, cupon_id: 7, monto: 144, metodo: "YAPE", datos_facturacion: { tipo: "BOLETA" } });
    expect(entorno.admin.de("registro_actividad")[0].valores).toMatchObject({
      accion: "INSCRIPCION_CREADA",
      detalle: { inscripcion: UUID.inscripcion, metodo: "YAPE", monto: 144, cupon: "PROMO20", comprobante: "BOLETA" },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/estudiante", "layout");

    await ejecutarTareas();
    expect(console.info).toHaveBeenCalledWith(expect.stringMatching(/estudiante@pedsar\.test: .*Excel avanzado/));
  });

  it("con un cupón del 100 % no hay nada que cobrar: confirma la matrícula de inmediato", async () => {
    conSesion("estudiante");
    conCurso(inscripcionCreada, { cupones: { data: { ...CUPON_VIGENTE, porcentaje_descuento: "100.00" } }, "pagos.insert": { data: { id: UUID.pago } } });
    await expect(inscribirse(datos({ metodo: "CULQI", cupon: "BECA100" }))).rejects.toEqual(new Redireccion("/estudiante/cursos"));
    expect(entorno.admin.de("pagos", "insert")[0].valores).toMatchObject({ monto: 0, metodo: "CULQI" });
    expect(confirmarPago).toHaveBeenCalledWith(UUID.pago, { actor: UUID.estudiante });
    expect(entorno.tareas).toHaveLength(0);
  });

  it("sin cupón cobra el precio completo y guarda los datos de la factura", async () => {
    conSesion("estudiante");
    conCurso({ data: { ...inscripcionCreada.data, vence_en: null } });
    await expect(inscribirse(datos({ metodo: "PLIN", comprobante: "FACTURA", ruc: "20605615521", razonSocial: "Empresa SAC" }))).rejects.toBeInstanceOf(Redireccion);
    expect(entorno.servidor.de("perfiles")).toHaveLength(0);
    expect(entorno.admin.de("pagos", "insert")[0].valores).toMatchObject({ cupon_id: null, monto: 180, metodo: "PLIN", datos_facturacion: { tipo: "FACTURA", ruc: "20605615521", razon_social: "Empresa SAC" } });
    expect(entorno.admin.de("registro_actividad")[0].valores).toMatchObject({ detalle: { ruc: "20605615521", razon_social: "Empresa SAC", cupon: null } });
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
