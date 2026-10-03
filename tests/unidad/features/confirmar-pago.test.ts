import { describe, expect, it, vi } from "vitest";
import { conciliarPago, confirmarPago } from "@/features/matricula/confirmar-pago";
import { programarCorreo } from "@/lib/email";
import { entorno, responder, UUID } from "../../apoyo/entorno";

vi.mock("@/lib/email", () => ({ programarCorreo: vi.fn() }));
const pasarela = vi.hoisted(() => ({ consultar: vi.fn() }));
vi.mock("@/lib/pagos", async (original) => ({ ...(await original<typeof import("@/lib/pagos")>()), getPasarela: () => pasarela }));

const pago = (estado = "PENDIENTE", inscripcion: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) => ({
  data: {
    id: UUID.pago,
    estado,
    referencia_pasarela: null,
    ...extra,
    inscripcion: {
      id: UUID.inscripcion,
      codigo: "MAT-AB12CD34",
      estado: "PENDIENTE",
      estudiante_id: UUID.estudiante,
      curso_id: UUID.curso,
      estudiante: { nombres: "Ana", correo: "ana@pedsar.test" },
      curso: { titulo: "Excel" },
      ...inscripcion,
    },
  },
});
const COMPROBANTE = { data: { id: 41, serie: "CP01", numero: "000001" } };
const ACTUALIZADO = { data: { id: UUID.pago } };
const auditadas = () => entorno.admin.de("registro_actividad").map((c) => c.valores as { accion: string; usuario_id: string | null });

describe("confirmarPago: único punto de confirmación de un pago", () => {
  it("aprueba el pago, confirma la matrícula, avisa y envía el correo con el comprobante", async () => {
    responder({}, { "pagos.select": pago(), "pagos.update": ACTUALIZADO, comprobantes: COMPROBANTE });
    const respuesta = { id: "chr_1" };
    await expect(confirmarPago(UUID.pago, { referencia: "chr_1", medio: "TARJETA", respuesta, actor: UUID.estudiante })).resolves.toBe("CONFIRMADO");

    expect(entorno.admin.de("pagos", "update")[0]).toMatchObject({
      valores: { estado: "APROBADO", fecha_pago: expect.any(String), referencia_pasarela: "chr_1", medio: "TARJETA", respuesta_pasarela: respuesta, observacion: null },
      // Solo desde estos estados: un pago REEMBOLSADO no vuelve a la vida con un aviso repetido.
      filtros: expect.arrayContaining([["eq", "id", UUID.pago], ["in", "estado", ["PENDIENTE", "VENCIDO", "RECHAZADO"]]]),
    });
    expect(entorno.admin.de("inscripciones", "update")[0]).toMatchObject({ valores: { estado: "CONFIRMADA", vence_en: null }, filtros: [["eq", "id", UUID.inscripcion]] });
    expect(entorno.admin.de("notificaciones")[0].valores).toMatchObject({ usuario_id: UUID.estudiante, enlace: "/estudiante/cursos", mensaje: expect.stringContaining("Excel") });
    expect(auditadas()).toEqual([expect.objectContaining({ accion: "PAGO_APROBADO", usuario_id: UUID.estudiante })]);

    expect(programarCorreo).toHaveBeenCalledTimes(1);
    const correo = vi.mocked(programarCorreo).mock.calls[0][0];
    expect(correo.para).toBe("ana@pedsar.test");
    expect(correo.html).toContain("CP01-000001");
    expect(correo.html).toContain("https://pedsar.test/comprobantes/41/pdf");
  });

  it("la validación manual no cambia la referencia ni el medio del pago", async () => {
    responder({}, { "pagos.select": pago(), "pagos.update": ACTUALIZADO, comprobantes: COMPROBANTE });
    await confirmarPago(UUID.pago, { actor: UUID.admin });
    const valores = entorno.admin.de("pagos", "update")[0].valores as Record<string, unknown>;
    expect(valores).toEqual({ estado: "APROBADO", fecha_pago: expect.any(String), observacion: null });
  });

  it("un pago ya aprobado no se vuelve a confirmar ni duplica el correo", async () => {
    responder({}, { "pagos.select": pago("APROBADO", { estado: "CONFIRMADA" }) });
    await expect(confirmarPago(UUID.pago, { referencia: "chr_1", actor: null })).resolves.toBe("YA_APROBADO");
    expect(entorno.admin.de("pagos", "update")).toHaveLength(0);
    expect(programarCorreo).not.toHaveBeenCalled();
  });

  it("si otra vía lo aprobó al mismo tiempo (webhook y cargo), solo una lo confirma", async () => {
    responder({}, { "pagos.select": pago(), "pagos.update": { data: null } });
    await expect(confirmarPago(UUID.pago, { referencia: "chr_1", actor: null })).resolves.toBe("YA_APROBADO");
    expect(entorno.admin.de("inscripciones", "update")).toHaveLength(0);
    expect(programarCorreo).not.toHaveBeenCalled();
  });

  it("reactiva una reserva vencida si aún hay cupo", async () => {
    responder({}, { "pagos.select": pago("VENCIDO", { estado: "CANCELADA" }), "pagos.update": ACTUALIZADO, "rpc:cupo_disponible": { data: 3 }, "inscripciones.select": { data: [] }, comprobantes: COMPROBANTE });
    await expect(confirmarPago(UUID.pago, { referencia: "ord_1", medio: "BILLETERA", actor: null })).resolves.toBe("CONFIRMADO");
    expect(entorno.admin.de("rpc:cupo_disponible")[0].valores).toEqual({ p_curso: UUID.curso });
    expect(entorno.admin.de("inscripciones", "update")[0].valores).toEqual({ estado: "CONFIRMADA", vence_en: null });
  });

  it.each([
    ["no queda cupo", { data: 0 }, { data: [] }],
    ["el estudiante ya volvió a inscribirse", { data: 5 }, { data: [{ id: UUID.otra }] }],
  ])("si %s, deja el pago aprobado y pide reembolsar", async (_, cupo, otras) => {
    responder({}, { "pagos.select": pago("VENCIDO", { estado: "CANCELADA" }), "pagos.update": ACTUALIZADO, "rpc:cupo_disponible": cupo, "inscripciones.select": otras, perfiles: { data: [{ id: UUID.admin }] }, comprobantes: COMPROBANTE });
    await expect(confirmarPago(UUID.pago, { referencia: "ord_1", actor: null })).resolves.toBe("SIN_CUPO");
    expect(entorno.admin.de("pagos", "update")).toHaveLength(1);
    expect(entorno.admin.de("inscripciones", "update")).toHaveLength(0);
    const avisos = entorno.admin.de("notificaciones").flatMap((c) => [c.valores].flat()) as { usuario_id: string; mensaje: string }[];
    expect(avisos).toContainEqual(expect.objectContaining({ usuario_id: UUID.admin, mensaje: expect.stringContaining("reembolsar") }));
    expect(avisos).toContainEqual(expect.objectContaining({ usuario_id: UUID.estudiante }));
    expect(programarCorreo).not.toHaveBeenCalled();
  });

  it("no hace nada con un pago inexistente", async () => {
    responder();
    await expect(confirmarPago(UUID.pago, { actor: null })).resolves.toBe("NO_ENCONTRADO");
    expect(entorno.admin.de("pagos", "update")).toHaveLength(0);
  });

  it("un segundo cobro con otra referencia sobre un pago ya aprobado se avisa para reembolsar", async () => {
    responder({}, { "pagos.select": pago("APROBADO", { estado: "CONFIRMADA" }, { referencia_pasarela: "chr_1" }), perfiles: { data: [{ id: UUID.admin }] } });
    await expect(confirmarPago(UUID.pago, { referencia: "ord_1", medio: "BILLETERA", actor: null })).resolves.toBe("DUPLICADO");
    expect(entorno.admin.de("pagos", "update")).toHaveLength(0);
    expect(auditadas()).toEqual([expect.objectContaining({ accion: "PAGO_DUPLICADO" })]);
    const avisos = entorno.admin.de("notificaciones").flatMap((c) => [c.valores].flat()) as { usuario_id: string; mensaje: string }[];
    expect(avisos).toContainEqual(expect.objectContaining({ usuario_id: UUID.admin, mensaje: expect.stringContaining("duplicado") }));
    expect(programarCorreo).not.toHaveBeenCalled();
  });

  it("un aviso repetido de un pago reembolsado no lo reactiva", async () => {
    responder({}, { "pagos.select": pago("REEMBOLSADO", { estado: "CANCELADA" }, { referencia_pasarela: "chr_1" }) });
    await expect(confirmarPago(UUID.pago, { referencia: "chr_1", actor: null })).resolves.toBe("YA_APROBADO");
    expect(entorno.admin.de("pagos", "update")).toHaveLength(0);
    expect(entorno.admin.de("inscripciones", "update")).toHaveLength(0);
  });

  it("si la BD falla al aprobar, lanza el error (el webhook responde 500 y Culqi reintenta)", async () => {
    responder({}, { "pagos.select": pago(), "pagos.update": { error: { message: "conexión perdida" } } });
    await expect(confirmarPago(UUID.pago, { referencia: "chr_1", actor: null })).rejects.toThrow("conexión perdida");
    expect(entorno.admin.de("inscripciones", "update")).toHaveLength(0);
  });

  it("si no puede confirmar la matrícula, avisa al administrador y lanza el error", async () => {
    responder({}, { "pagos.select": pago(), "pagos.update": ACTUALIZADO, "inscripciones.update": { error: { message: "índice único" } }, perfiles: { data: [{ id: UUID.admin }] } });
    await expect(confirmarPago(UUID.pago, { referencia: "chr_1", actor: null })).rejects.toThrow("índice único");
    const avisos = entorno.admin.de("notificaciones").flatMap((c) => [c.valores].flat()) as { usuario_id: string; mensaje: string }[];
    expect(avisos).toContainEqual(expect.objectContaining({ usuario_id: UUID.admin, mensaje: expect.stringContaining("no se pudo confirmar la matrícula") }));
    expect(programarCorreo).not.toHaveBeenCalled();
  });

  it("un reintento completa la matrícula de un pago ya aprobado que quedó sin confirmar", async () => {
    responder({}, { "pagos.select": pago("APROBADO", {}, { referencia_pasarela: "chr_1" }), comprobantes: COMPROBANTE });
    await expect(confirmarPago(UUID.pago, { referencia: "chr_1", actor: null })).resolves.toBe("CONFIRMADO");
    expect(entorno.admin.de("pagos", "update")).toHaveLength(0);
    expect(entorno.admin.de("inscripciones", "update")[0].valores).toEqual({ estado: "CONFIRMADA", vence_en: null });
    expect(programarCorreo).toHaveBeenCalledTimes(1);
  });
});

describe("conciliarPago: confirma consultando la pasarela si el aviso no llegó", () => {
  const PAGO_CULQI = { data: { id: UUID.pago, metodo: "CULQI", monto: 144, orden_pasarela: "ord_1", referencia_pasarela: null } };

  it("con la orden pagada y el monto correcto, confirma el pago", async () => {
    responder({}, { "pagos.select": [PAGO_CULQI, pago()], "pagos.update": ACTUALIZADO, comprobantes: COMPROBANTE });
    pasarela.consultar.mockResolvedValueOnce({ estado: "PAGADO", pagoId: UUID.pago, montoCentimos: 14400, medio: "BILLETERA", referencia: "ord_1", respuesta: {} });
    await expect(conciliarPago(UUID.pago, UUID.admin)).resolves.toBe("CONFIRMADO");
    expect(pasarela.consultar).toHaveBeenCalledWith({ tipo: "orden", id: "ord_1" });
  });

  it("sin pago en Culqi, con otro monto o sin referencia, no confirma", async () => {
    responder({}, { "pagos.select": PAGO_CULQI });
    pasarela.consultar.mockResolvedValueOnce({ estado: "PENDIENTE", pagoId: UUID.pago, montoCentimos: 14400, medio: "BILLETERA", referencia: "ord_1", respuesta: {} });
    await expect(conciliarPago(UUID.pago, null)).resolves.toBe("NO_PAGADO");

    responder({}, { "pagos.select": PAGO_CULQI });
    pasarela.consultar.mockResolvedValueOnce({ estado: "PAGADO", pagoId: UUID.pago, montoCentimos: 100, medio: "BILLETERA", referencia: "ord_1", respuesta: {} });
    await expect(conciliarPago(UUID.pago, null)).resolves.toBe("MONTO_DISTINTO");

    responder({}, { "pagos.select": { data: { ...PAGO_CULQI.data, orden_pasarela: null } } });
    await expect(conciliarPago(UUID.pago, null)).resolves.toBe("SIN_REFERENCIA");
    expect(entorno.admin.de("pagos", "update")).toHaveLength(0);
  });

  it("también verifica un cargo con tarjeta o Yape", async () => {
    responder({}, { "pagos.select": [{ data: { ...PAGO_CULQI.data, orden_pasarela: null, referencia_pasarela: "chr_9" } }, pago()], "pagos.update": ACTUALIZADO, comprobantes: COMPROBANTE });
    pasarela.consultar.mockResolvedValueOnce({ estado: "PAGADO", pagoId: UUID.pago, montoCentimos: 14400, medio: "TARJETA", referencia: "chr_9", respuesta: {} });
    await expect(conciliarPago(UUID.pago, null)).resolves.toBe("CONFIRMADO");
    expect(pasarela.consultar).toHaveBeenCalledWith({ tipo: "cargo", id: "chr_9" });
  });
});
