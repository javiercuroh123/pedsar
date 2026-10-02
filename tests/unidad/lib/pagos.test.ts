import { afterEach, describe, expect, it, vi } from "vitest";
import { esPasarelaValida, getPasarela } from "@/lib/pagos";

const respuesta = (status: number, json: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => json });
type Llamada = [string, RequestInit];

/** Carga de nuevo @/lib/pagos con la clave secreta y un `fetch` que responde en orden. */
async function conCulqi(...respuestas: (ReturnType<typeof respuesta> | Error)[]) {
  vi.stubEnv("CULQI_SECRET_KEY", "sk_test_prueba");
  const fetch = vi.fn();
  for (const r of respuestas) {
    if (r instanceof Error) fetch.mockRejectedValueOnce(r);
    else fetch.mockResolvedValueOnce(r);
  }
  vi.stubGlobal("fetch", fetch);
  vi.resetModules();
  const modulo = await import("@/lib/pagos");
  const llamada = (i = 0) => {
    const [url, init] = fetch.mock.calls[i] as unknown as Llamada;
    return { url, init, cuerpo: init.body ? JSON.parse(init.body as string) : undefined };
  };
  return { culqi: modulo.getPasarela("culqi"), modulo, fetch, llamada };
}

const ORDEN = {
  pagoId: "pago-1",
  montoSoles: 144,
  descripcion: "Inscripción · Excel empresarial",
  numeroOrden: "PED-2026-0001-k1",
  cliente: { nombres: "Ana", apellidos: "Quispe", correo: "ana@pedsar.test", telefono: "956000000" },
  venceEn: new Date("2026-10-04T15:00:00Z"),
};
const COBRO = { pagoId: "pago-1", montoSoles: 144, descripcion: "x".repeat(120), correo: "ana@pedsar.test", token: "tkn_test_1" };
const CARGO_EXITOSO = { object: "charge", id: "chr_test_1", outcome: { type: "venta_exitosa", user_message: "Su compra ha sido exitosa" } };

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("pasarelas de pago intercambiables", () => {
  it("elige la pasarela configurada y valida el proveedor del webhook", () => {
    expect(getPasarela().nombre).toBe("culqi");
    expect(getPasarela("niubiz").nombre).toBe("niubiz");
    expect(esPasarelaValida("izipay")).toBe(true);
    expect(esPasarelaValida("paypal")).toBe(false);
  });

  it("Izipay y Niubiz avisan que su integración está pendiente", async () => {
    for (const nombre of ["izipay", "niubiz"] as const) {
      const p = getPasarela(nombre);
      await expect(p.crearOrden(ORDEN)).rejects.toThrow(/pendiente/);
      await expect(p.cobrar(COBRO)).rejects.toThrow(/pendiente/);
      await expect(p.consultar({ tipo: "orden", id: "x" })).rejects.toThrow(/pendiente/);
      await expect(p.reembolsar("ref", 1, "motivo")).rejects.toThrow(/pendiente/);
      expect(p.leerWebhook("{}")).toBeNull();
    }
  });

  it("la pasarela está activa solo con las dos llaves de Culqi y la clave del webhook", async () => {
    vi.resetModules();
    expect((await import("@/lib/pagos")).pasarelaActiva()).toBe(false);
    vi.stubEnv("CULQI_SECRET_KEY", "sk_test_prueba");
    vi.stubEnv("NEXT_PUBLIC_CULQI_PUBLIC_KEY", "pk_test_prueba");
    vi.resetModules();
    // Sin la clave del webhook, los pagos por billetera nunca se confirmarían.
    expect((await import("@/lib/pagos")).pasarelaActiva()).toBe(false);
    vi.stubEnv("CULQI_WEBHOOK_SECRET", "secreto");
    vi.resetModules();
    expect((await import("@/lib/pagos")).pasarelaActiva()).toBe(true);
  });

  it("el pago directo por Yape / Plin está habilitado salvo que se apague", async () => {
    vi.resetModules();
    expect((await import("@/lib/pagos")).pagoManualHabilitado()).toBe(true);
    vi.stubEnv("PAGO_MANUAL_HABILITADO", "false");
    vi.resetModules();
    expect((await import("@/lib/pagos")).pagoManualHabilitado()).toBe(false);
  });
});

describe("órdenes de Culqi (billeteras, banca móvil y agentes)", () => {
  it("crea la orden en céntimos, con el cliente, el vencimiento de la reserva y la referencia del pago", async () => {
    const { culqi, llamada } = await conCulqi(respuesta(201, { object: "order", id: "ord_test_1", state: "pending" }));
    await expect(culqi.crearOrden(ORDEN)).resolves.toEqual({ id: "ord_test_1" });
    const { url, init, cuerpo } = llamada();
    expect(url).toBe("https://api.culqi.com/v2/orders");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ Authorization: "Bearer sk_test_prueba" });
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(cuerpo).toMatchObject({
      amount: 14400,
      currency_code: "PEN",
      order_number: "PED-2026-0001-k1",
      expiration_date: Math.floor(ORDEN.venceEn.getTime() / 1000),
      client_details: { first_name: "Ana", last_name: "Quispe", email: "ana@pedsar.test", phone_number: "956000000" },
      metadata: { pago_id: "pago-1" },
    });
  });

  it("consulta la orden y traduce su estado", async () => {
    const orden = (state: string) => respuesta(200, { object: "order", id: "ord_1", state, amount: 14400, metadata: { pago_id: "pago-1" } });
    const { culqi, llamada } = await conCulqi(orden("paid"), orden("pending"), orden("expired"), orden("deleted"));
    await expect(culqi.consultar({ tipo: "orden", id: "ord_1" })).resolves.toMatchObject({
      estado: "PAGADO",
      pagoId: "pago-1",
      montoCentimos: 14400,
      medio: "BILLETERA",
      referencia: "ord_1",
    });
    expect(llamada().url).toBe("https://api.culqi.com/v2/orders/ord_1");
    expect(llamada().init.method ?? "GET").toBe("GET");
    await expect(culqi.consultar({ tipo: "orden", id: "ord_1" })).resolves.toMatchObject({ estado: "PENDIENTE" });
    await expect(culqi.consultar({ tipo: "orden", id: "ord_1" })).resolves.toMatchObject({ estado: "EXPIRADO" });
    await expect(culqi.consultar({ tipo: "orden", id: "ord_1" })).resolves.toMatchObject({ estado: "EXPIRADO" });
  });

  it("si Culqi rechaza la orden, informa el código y el detalle; sin teléfono no envía phone_number", async () => {
    const { culqi, modulo, llamada } = await conCulqi(respuesta(400, { object: "error", merchant_message: "phone_number es requerido" }));
    const error = await culqi.crearOrden({ ...ORDEN, cliente: { ...ORDEN.cliente, telefono: null } }).catch((e) => e);
    expect(error).toBeInstanceOf(modulo.ErrorPasarela);
    expect(error).toMatchObject({ status: 400, detalle: { merchant_message: "phone_number es requerido" } });
    expect(llamada().cuerpo.client_details).not.toHaveProperty("phone_number");
  });

  it("no crea órdenes sin la clave secreta", async () => {
    await expect(getPasarela("culqi").crearOrden(ORDEN)).rejects.toThrow("CULQI_SECRET_KEY no configurada");
  });
});

describe("cargos de Culqi (tarjeta y Yape)", () => {
  it("cobra en céntimos con el token, la huella del dispositivo y la referencia del pago", async () => {
    const { culqi, llamada } = await conCulqi(respuesta(201, CARGO_EXITOSO));
    await expect(culqi.cobrar({ ...COBRO, huellaDispositivo: "huella-1" })).resolves.toMatchObject({
      estado: "APROBADO",
      referencia: "chr_test_1",
      medio: "TARJETA",
      mensaje: "Su compra ha sido exitosa",
    });
    const { url, cuerpo } = llamada();
    expect(url).toBe("https://api.culqi.com/v2/charges");
    expect(cuerpo).toMatchObject({
      amount: 14400,
      currency_code: "PEN",
      email: "ana@pedsar.test",
      source_id: "tkn_test_1",
      metadata: { pago_id: "pago-1" },
      antifraud_details: { device_finger_print_id: "huella-1" },
    });
    expect(cuerpo.description).toHaveLength(80);
    expect(cuerpo.authentication_3DS).toBeUndefined();
  });

  it("reconoce los tokens de Yape", async () => {
    const { culqi } = await conCulqi(respuesta(201, { ...CARGO_EXITOSO, id: "chr_test_2" }));
    await expect(culqi.cobrar({ ...COBRO, token: "ype_test_1" })).resolves.toMatchObject({ estado: "APROBADO", medio: "YAPE" });
  });

  it("pide la verificación 3DS y reintenta con sus parámetros", async () => {
    const autenticacion3DS = { eci: "05", xid: "x", cavv: "c", protocolVersion: "2.1.0", directoryServerTransactionId: "d" };
    const { culqi, llamada } = await conCulqi(respuesta(200, { action_code: "REVIEW", user_message: "Autenticación requerida" }), respuesta(201, CARGO_EXITOSO));
    await expect(culqi.cobrar(COBRO)).resolves.toMatchObject({ estado: "REQUIERE_3DS", referencia: null });
    await expect(culqi.cobrar({ ...COBRO, autenticacion3DS })).resolves.toMatchObject({ estado: "APROBADO" });
    expect(llamada(1).cuerpo.authentication_3DS).toEqual(autenticacion3DS);
  });

  it("devuelve el motivo del rechazo de la tarjeta", async () => {
    const { culqi } = await conCulqi(respuesta(402, { object: "error", type: "card_error", user_message: "Fondos insuficientes" }));
    await expect(culqi.cobrar(COBRO)).resolves.toMatchObject({ estado: "RECHAZADO", referencia: null, medio: "TARJETA", mensaje: "Fondos insuficientes" });
  });

  it("consulta un cargo y traduce su resultado", async () => {
    const { culqi, llamada } = await conCulqi(
      respuesta(200, { ...CARGO_EXITOSO, amount: 14400, source: { id: "ype_test_9" }, metadata: { pago_id: "pago-1" } }),
      respuesta(200, { object: "charge", id: "chr_x", outcome: { type: "venta_denegada" }, amount: 14400, metadata: {} }),
    );
    await expect(culqi.consultar({ tipo: "cargo", id: "chr_test_1" })).resolves.toMatchObject({
      estado: "PAGADO",
      pagoId: "pago-1",
      montoCentimos: 14400,
      medio: "YAPE",
      referencia: "chr_test_1",
    });
    expect(llamada().url).toBe("https://api.culqi.com/v2/charges/chr_test_1");
    await expect(culqi.consultar({ tipo: "cargo", id: "chr_x" })).resolves.toMatchObject({ estado: "RECHAZADO", pagoId: null });
  });

  it("reembolsa en céntimos e informa si Culqi lo rechaza", async () => {
    const { culqi, llamada } = await conCulqi(respuesta(201, { object: "refund", id: "ref_1" }), respuesta(400, { user_message: "Monto inválido" }));
    await expect(culqi.reembolsar("chr_9", 99.99, "solicitud del cliente")).resolves.toMatchObject({ aprobado: true, referencia: "ref_1" });
    // Culqi solo acepta motivos de su lista; el texto del estudiante queda en PEDSAR.
    expect(llamada().cuerpo).toEqual({ amount: 9999, charge_id: "chr_9", reason: "solicitud_comprador" });
    await expect(culqi.reembolsar("chr_9", 10, "x")).resolves.toMatchObject({ aprobado: false, mensaje: "Monto inválido" });
  });
});

describe("conexión con Culqi", () => {
  it.each([
    ["no responde a tiempo", new DOMException("The operation was aborted due to timeout", "TimeoutError")],
    ["responde con error 500", respuesta(500, { message: "Internal error" })],
  ])("si Culqi %s, avisa que no se pudo conectar", async (_, falla) => {
    for (const operacion of ["orden", "cargo", "consulta", "reembolso"] as const) {
      const { culqi, modulo } = await conCulqi(falla as never);
      const promesa =
        operacion === "orden"
          ? culqi.crearOrden(ORDEN)
          : operacion === "cargo"
            ? culqi.cobrar(COBRO)
            : operacion === "consulta"
              ? culqi.consultar({ tipo: "orden", id: "ord_1" })
              : culqi.reembolsar("chr_1", 10, "x");
      await expect(promesa).rejects.toBeInstanceOf(modulo.ErrorPasarela);
      await expect(promesa).rejects.toThrow("No pudimos conectar con la pasarela de pagos");
    }
  });
});

describe("webhook de Culqi: solo indica qué consultar", () => {
  const culqi = getPasarela("culqi");
  const evento = (type: string, data: unknown) => JSON.stringify({ object: "event", type, data });

  it("reconoce órdenes y cargos (data como objeto o como texto JSON)", () => {
    expect(culqi.leerWebhook(evento("order.status.changed", { id: "ord_1", state: "paid" }))).toEqual({ tipo: "orden", id: "ord_1" });
    expect(culqi.leerWebhook(evento("charge.creation.succeeded", JSON.stringify({ id: "chr_1" })))).toEqual({ tipo: "cargo", id: "chr_1" });
  });

  it("ignora otros eventos, los que no traen id y los cuerpos que no son JSON", () => {
    expect(culqi.leerWebhook(evento("customer.creation.succeeded", { id: "cus_1" }))).toBeNull();
    expect(culqi.leerWebhook(evento("order.status.changed", {}))).toBeNull();
    expect(culqi.leerWebhook("no es json")).toBeNull();
  });
});
