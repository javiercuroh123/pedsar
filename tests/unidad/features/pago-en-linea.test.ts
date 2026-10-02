import { beforeEach, describe, expect, it, vi } from "vitest";
import { cambiarAPagoDirecto, cobrarConToken, estadoDelPago, prepararPagoEnLinea } from "@/features/matricula/pago-en-linea";
import { confirmarPago } from "@/features/matricula/confirmar-pago";
import { requireRol } from "@/lib/auth";
import { conSesion, entorno, responder, UUID } from "../../apoyo/entorno";

vi.mock("@/lib/auth", () => import("../../apoyo/auth-falso"));
vi.mock("@/features/matricula/confirmar-pago", () => ({ confirmarPago: vi.fn(async () => "CONFIRMADO") }));

const { pasarela, disponibilidad } = vi.hoisted(() => {
  process.env.NEXT_PUBLIC_CULQI_PUBLIC_KEY = "pk_test_prueba";
  return {
    pasarela: { crearOrden: vi.fn(), cobrar: vi.fn(), consultar: vi.fn() },
    disponibilidad: { activa: true, manual: true },
  };
});
vi.mock("@/lib/pagos", async (original) => ({
  ...(await original<typeof import("@/lib/pagos")>()),
  getPasarela: () => pasarela,
  pasarelaActiva: () => disponibilidad.activa,
  pagoManualHabilitado: () => disponibilidad.manual,
}));
const { ErrorPasarela } = await vi.importActual<typeof import("@/lib/pagos")>("@/lib/pagos");

beforeEach(() => {
  disponibilidad.activa = true;
  disponibilidad.manual = true;
  vi.useFakeTimers({ now: new Date("2026-10-02T15:00:00Z"), toFake: ["Date"] });
});

const VENCE = "2026-10-04T15:00:00Z";
/** Pago con cupón: S/ 144 (180 − 20 %). */
const pagoCulqi = (pago: Record<string, unknown> = {}, inscripcion: Record<string, unknown> = {}) => ({
  data: {
    id: UUID.pago,
    estado: "PENDIENTE",
    metodo: "CULQI",
    monto: 144,
    orden_pasarela: null,
    inscripcion: { id: UUID.inscripcion, codigo: "MAT-AB12CD34", estado: "PENDIENTE", vence_en: VENCE, curso: { titulo: "Excel avanzado" }, estudiante: { telefono: "956000000" }, ...inscripcion },
    ...pago,
  },
});

describe("preparar el pago en línea (orden de Culqi)", () => {
  it("solo el estudiante dueño del pago lo prepara", async () => {
    conSesion("instructor");
    await expect(prepararPagoEnLinea(UUID.pago)).rejects.toBeTruthy();
    expect(requireRol).toHaveBeenCalledWith("estudiante");
  });

  it("crea la orden por el monto con descuento y con el vencimiento de la reserva", async () => {
    conSesion("estudiante", { nombres: "Ana", apellidos: "Quispe" });
    responder({ pagos: pagoCulqi() });
    pasarela.crearOrden.mockResolvedValueOnce({ id: "ord_test_1" });
    await expect(prepararPagoEnLinea(UUID.pago)).resolves.toEqual({
      ok: true,
      checkout: { llavePublica: "pk_test_prueba", montoCentimos: 14400, ordenId: "ord_test_1", correo: "estudiante@pedsar.test", nombres: "Ana", apellidos: "Quispe", titulo: "Excel avanzado" },
    });
    expect(pasarela.crearOrden).toHaveBeenCalledWith({
      pagoId: UUID.pago,
      montoSoles: 144,
      descripcion: "Inscripción MAT-AB12CD34 · Excel avanzado",
      numeroOrden: expect.stringMatching(/^MAT-AB12CD34-\w+$/),
      cliente: { nombres: "Ana", apellidos: "Quispe", correo: "estudiante@pedsar.test", telefono: "956000000" },
      venceEn: new Date(VENCE),
    });
    expect(entorno.admin.de("pagos", "update")[0]).toMatchObject({ valores: { orden_pasarela: "ord_test_1" }, filtros: [["eq", "id", UUID.pago]] });
  });

  it("reutiliza la orden pendiente (doble clic) y crea otra si la anterior venció", async () => {
    conSesion("estudiante");
    responder({ pagos: pagoCulqi({ orden_pasarela: "ord_viejo" }) });
    pasarela.consultar.mockResolvedValueOnce({ estado: "PENDIENTE" });
    await expect(prepararPagoEnLinea(UUID.pago)).resolves.toMatchObject({ ok: true, checkout: { ordenId: "ord_viejo" } });
    expect(pasarela.consultar).toHaveBeenCalledWith({ tipo: "orden", id: "ord_viejo" });
    expect(pasarela.crearOrden).not.toHaveBeenCalled();

    responder({ pagos: pagoCulqi({ orden_pasarela: "ord_viejo" }) });
    pasarela.consultar.mockResolvedValueOnce({ estado: "EXPIRADO" });
    pasarela.crearOrden.mockResolvedValueOnce({ id: "ord_nuevo" });
    await expect(prepararPagoEnLinea(UUID.pago)).resolves.toMatchObject({ ok: true, checkout: { ordenId: "ord_nuevo" } });
  });

  it("si la billetera ya pagó la orden (y el aviso no llegó), confirma el pago en ese momento", async () => {
    conSesion("estudiante");
    responder({ pagos: pagoCulqi({ orden_pasarela: "ord_pagado" }) });
    pasarela.consultar.mockResolvedValueOnce({ estado: "PAGADO", montoCentimos: 14400, medio: "BILLETERA", referencia: "ord_pagado", respuesta: { id: "ord_pagado" } });
    await expect(prepararPagoEnLinea(UUID.pago)).resolves.toEqual({ ok: false, aprobado: true, mensaje: "¡Ya recibimos tu pago! Tu matrícula quedó confirmada." });
    expect(confirmarPago).toHaveBeenCalledWith(UUID.pago, { referencia: "ord_pagado", medio: "BILLETERA", respuesta: { id: "ord_pagado" }, actor: UUID.estudiante });
    expect(pasarela.crearOrden).not.toHaveBeenCalled();
  });

  it("si Culqi rechaza la orden, igual permite pagar con tarjeta o Yape (sin billeteras) y registra el motivo", async () => {
    conSesion("estudiante");
    responder({ pagos: pagoCulqi() });
    pasarela.crearOrden.mockRejectedValueOnce(new ErrorPasarela({ merchant_message: "phone_number es requerido" }, 400));
    await expect(prepararPagoEnLinea(UUID.pago)).resolves.toMatchObject({ ok: true, checkout: { ordenId: null, montoCentimos: 14400 } });
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("orden"), { merchant_message: "phone_number es requerido" });
    expect(entorno.admin.de("pagos", "update")).toHaveLength(0);
  });

  it.each([
    ["el pago no es suyo o no existe", { data: null }, "No encontramos ese pago"],
    ["es un pago directo por Yape", pagoCulqi({ metodo: "YAPE" }), "Este pago no se hace en línea"],
    ["ya fue aprobado", pagoCulqi({ estado: "APROBADO" }), "Este pago ya no está pendiente"],
    ["la inscripción fue cancelada", pagoCulqi({}, { estado: "CANCELADA" }), "Este pago ya no está pendiente"],
    ["la reserva venció", pagoCulqi({}, { vence_en: "2026-10-02T14:59:00Z" }), "Tu reserva venció. Vuelve a inscribirte para pagar."],
  ])("no prepara el pago si %s", async (_, pago, mensaje) => {
    conSesion("estudiante");
    responder({ pagos: pago });
    await expect(prepararPagoEnLinea(UUID.pago)).resolves.toEqual({ ok: false, mensaje });
    expect(pasarela.crearOrden).not.toHaveBeenCalled();
  });

  it("sin pasarela activa o si Culqi no responde, lo dice", async () => {
    conSesion("estudiante");
    disponibilidad.activa = false;
    await expect(prepararPagoEnLinea(UUID.pago)).resolves.toEqual({ ok: false, mensaje: "El pago en línea aún no está disponible" });

    disponibilidad.activa = true;
    responder({ pagos: pagoCulqi() });
    pasarela.crearOrden.mockRejectedValueOnce(new ErrorPasarela());
    await expect(prepararPagoEnLinea(UUID.pago)).resolves.toEqual({ ok: false, mensaje: "No pudimos conectar con la pasarela de pagos" });
  });
});

describe("cobrar con el token del checkout (tarjeta o Yape)", () => {
  const entrada = { pagoId: UUID.pago, token: "tkn_test_1", huella: "huella-1" };

  it("un cargo aprobado confirma el pago con la referencia y el medio", async () => {
    conSesion("estudiante");
    responder({ pagos: pagoCulqi() });
    const respuesta = { id: "chr_1" };
    pasarela.cobrar.mockResolvedValueOnce({ estado: "APROBADO", referencia: "chr_1", medio: "TARJETA", mensaje: "ok", respuesta });
    await expect(cobrarConToken(entrada)).resolves.toMatchObject({ estado: "APROBADO" });
    expect(pasarela.cobrar).toHaveBeenCalledWith({
      pagoId: UUID.pago,
      montoSoles: 144,
      descripcion: "Inscripción MAT-AB12CD34 · Excel avanzado",
      correo: "estudiante@pedsar.test",
      token: "tkn_test_1",
      huellaDispositivo: "huella-1",
      autenticacion3DS: undefined,
    });
    expect(confirmarPago).toHaveBeenCalledWith(UUID.pago, { referencia: "chr_1", medio: "TARJETA", respuesta, actor: UUID.estudiante });
  });

  it.each([
    ["SIN_CUPO", "no quedan cupos"],
    ["DUPLICADO", "cobro duplicado"],
  ])("si la confirmación resulta %s, se lo explica al estudiante", async (resultado, texto) => {
    conSesion("estudiante");
    responder({ pagos: pagoCulqi() });
    pasarela.cobrar.mockResolvedValueOnce({ estado: "APROBADO", referencia: "chr_1", medio: "TARJETA", mensaje: "ok", respuesta: {} });
    vi.mocked(confirmarPago).mockResolvedValueOnce(resultado as never);
    await expect(cobrarConToken(entrada)).resolves.toMatchObject({ estado: "APROBADO", mensaje: expect.stringContaining(texto) });
  });

  it("si el banco pide 3DS no confirma, y el reintento lleva sus parámetros", async () => {
    conSesion("estudiante");
    responder({ pagos: pagoCulqi() });
    pasarela.cobrar.mockResolvedValueOnce({ estado: "REQUIERE_3DS", referencia: null, medio: "TARJETA", mensaje: "Verifica", respuesta: {} });
    await expect(cobrarConToken(entrada)).resolves.toMatchObject({ estado: "REQUIERE_3DS" });
    expect(confirmarPago).not.toHaveBeenCalled();

    const autenticacion3DS = { eci: "05", xid: "x", cavv: "c", protocolVersion: "2.1.0", directoryServerTransactionId: "d" };
    responder({ pagos: pagoCulqi() });
    pasarela.cobrar.mockResolvedValueOnce({ estado: "APROBADO", referencia: "chr_2", medio: "TARJETA", mensaje: "ok", respuesta: {} });
    await cobrarConToken({ ...entrada, autenticacion3DS });
    expect(pasarela.cobrar).toHaveBeenLastCalledWith(expect.objectContaining({ autenticacion3DS }));
  });

  it("un rechazo guarda el motivo y no cancela la inscripción", async () => {
    conSesion("estudiante");
    responder({ pagos: pagoCulqi() });
    pasarela.cobrar.mockResolvedValueOnce({ estado: "RECHAZADO", referencia: null, medio: "TARJETA", mensaje: "Fondos insuficientes", respuesta: { code: "x" } });
    await expect(cobrarConToken(entrada)).resolves.toEqual({ estado: "RECHAZADO", mensaje: "Fondos insuficientes" });
    expect(entorno.admin.de("pagos", "update")[0]).toMatchObject({ valores: { observacion: "Fondos insuficientes" }, filtros: [["eq", "id", UUID.pago]] });
    expect(entorno.admin.de("inscripciones")).toHaveLength(0);
    expect(confirmarPago).not.toHaveBeenCalled();
  });

  it("si la reserva venció con el checkout abierto, no cobra", async () => {
    conSesion("estudiante");
    responder({ pagos: pagoCulqi({}, { vence_en: "2026-10-02T14:00:00Z" }) });
    await expect(cobrarConToken(entrada)).resolves.toEqual({ estado: "ERROR", mensaje: "Tu reserva venció. Vuelve a inscribirte para pagar." });
    expect(pasarela.cobrar).not.toHaveBeenCalled();
  });

  it("si Culqi no responde o los datos no son válidos, lo informa sin cobrar", async () => {
    conSesion("estudiante");
    responder({ pagos: pagoCulqi() });
    pasarela.cobrar.mockRejectedValueOnce(new ErrorPasarela());
    // Culqi pudo cobrar aunque no respondió a tiempo: no se invita a pagar otra vez.
    await expect(cobrarConToken(entrada)).resolves.toMatchObject({ estado: "ERROR", mensaje: expect.stringContaining("no vuelvas a pagar") });
    await expect(cobrarConToken({ pagoId: "no-es-uuid", token: "" })).resolves.toMatchObject({ estado: "ERROR" });
  });
});

describe("estado del pago (mientras se espera la billetera)", () => {
  it("devuelve el estado y el comprobante del pago propio", async () => {
    conSesion("estudiante");
    responder({ pagos: { data: { estado: "APROBADO", comprobantes: { id: 41 } } } });
    await expect(estadoDelPago(UUID.pago)).resolves.toEqual({ estado: "APROBADO", comprobanteId: 41 });
    expect(entorno.servidor.de("pagos")[0].filtros).toEqual([["eq", "id", UUID.pago]]);
    responder({ pagos: { data: null } });
    await expect(estadoDelPago(UUID.pago)).resolves.toEqual({ estado: null, comprobanteId: null });
  });
});

describe("cambiar al pago directo por Yape o Plin (si la pasarela falla)", () => {
  it("cambia el método de un pago en línea pendiente", async () => {
    conSesion("estudiante");
    responder({ pagos: pagoCulqi({ observacion: "Fondos insuficientes" }) });
    await expect(cambiarAPagoDirecto(UUID.pago, "PLIN")).resolves.toEqual({ ok: true, mensaje: "Listo: paga por Plin y registra el N.º de operación." });
    expect(entorno.admin.de("pagos", "update")[0]).toMatchObject({ valores: { metodo: "PLIN", medio: null, observacion: null }, filtros: [["eq", "id", UUID.pago], ["eq", "estado", "PENDIENTE"]] });
  });

  it("no lo permite si el pago directo está apagado, si el pago no es suyo o si la reserva venció", async () => {
    conSesion("estudiante");
    disponibilidad.manual = false;
    await expect(cambiarAPagoDirecto(UUID.pago, "YAPE")).resolves.toEqual({ ok: false, mensaje: "El pago directo por Yape o Plin no está disponible" });
    disponibilidad.manual = true;
    responder({ pagos: { data: null } });
    await expect(cambiarAPagoDirecto(UUID.pago, "YAPE")).resolves.toEqual({ ok: false, mensaje: "No encontramos ese pago" });
    responder({ pagos: pagoCulqi({}, { vence_en: "2026-10-02T14:00:00Z" }) });
    await expect(cambiarAPagoDirecto(UUID.pago, "YAPE")).resolves.toMatchObject({ ok: false });
    expect(entorno.admin.de("pagos", "update")).toHaveLength(0);
  });
});
