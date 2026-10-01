import { afterEach, describe, expect, it, vi } from "vitest";
import { esPasarelaValida, getPasarela } from "@/lib/pagos";

const evento = (type: string, data: unknown) => JSON.stringify({ type, data });

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
      await expect(p.cobrar({ pagoId: "p", montoSoles: 1, descripcion: "x", correo: "a@b.pe", metodo: "YAPE" })).rejects.toThrow(/pendiente/);
      await expect(p.reembolsar("ref", 1, "motivo")).rejects.toThrow(/pendiente/);
      await expect(p.procesarWebhook("{}", new Headers())).resolves.toBeNull();
    }
  });
});

describe("webhook de Culqi", () => {
  const culqi = getPasarela("culqi");

  it("traduce cargos exitosos y fallidos (data como objeto o como texto JSON)", async () => {
    await expect(culqi.procesarWebhook(evento("charge.succeeded", { id: "chr_1" }), new Headers())).resolves.toMatchObject({ referencia: "chr_1", estado: "APROBADO" });
    await expect(culqi.procesarWebhook(evento("charge.failed", JSON.stringify({ id: "chr_2" })), new Headers())).resolves.toMatchObject({ referencia: "chr_2", estado: "RECHAZADO" });
  });

  it("ignora otros eventos y los que no traen el cargo", async () => {
    await expect(culqi.procesarWebhook(evento("order.created", { id: "ord_1" }), new Headers())).resolves.toBeNull();
    await expect(culqi.procesarWebhook(evento("charge.succeeded", {}), new Headers())).resolves.toBeNull();
  });

  it("no cobra sin el token del checkout ni sin la clave secreta", async () => {
    await expect(culqi.cobrar({ pagoId: "p", montoSoles: 10, descripcion: "x", correo: "a@b.pe", metodo: "CULQI" })).rejects.toThrow("Falta el token");
    await expect(culqi.cobrar({ pagoId: "p", montoSoles: 10, descripcion: "x", correo: "a@b.pe", metodo: "CULQI", tokenCliente: "tkn" })).rejects.toThrow(
      "CULQI_SECRET_KEY no configurada",
    );
  });
});

describe("cobros con Culqi", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  const conClave = async (respuesta: { ok: boolean; json: unknown }) => {
    vi.stubEnv("CULQI_SECRET_KEY", "sk_test_prueba");
    const fetch = vi.fn(async () => ({ ok: respuesta.ok, json: async () => respuesta.json }));
    vi.stubGlobal("fetch", fetch);
    vi.resetModules();
    const { getPasarela: pasarela } = await import("@/lib/pagos");
    return { culqi: pasarela("culqi"), fetch };
  };

  it("cobra en céntimos con la referencia del pago y aprueba solo la venta exitosa", async () => {
    const { culqi, fetch } = await conClave({ ok: true, json: { id: "chr_9", outcome: { type: "venta_exitosa", user_message: "Su compra ha sido exitosa" } } });
    const r = await culqi.cobrar({ pagoId: "pago-1", montoSoles: 180.5, descripcion: "x".repeat(120), correo: "a@b.pe", metodo: "CULQI", tokenCliente: "tkn_1" });
    expect(r).toMatchObject({ aprobado: true, referencia: "chr_9", mensaje: "Su compra ha sido exitosa" });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.culqi.com/v2/charges");
    expect(init.headers).toMatchObject({ Authorization: "Bearer sk_test_prueba" });
    expect(JSON.parse(init.body as string)).toMatchObject({ amount: 18050, currency_code: "PEN", source_id: "tkn_1", metadata: { pago_id: "pago-1" } });
    expect(JSON.parse(init.body as string).description).toHaveLength(80);
  });

  it("rechaza si Culqi responde con error y reembolsa en céntimos", async () => {
    const { culqi, fetch } = await conClave({ ok: false, json: { user_message: "Tarjeta rechazada" } });
    await expect(culqi.cobrar({ pagoId: "p", montoSoles: 10, descripcion: "x", correo: "a@b.pe", metodo: "CULQI", tokenCliente: "t" })).resolves.toMatchObject({
      aprobado: false,
      referencia: null,
      mensaje: "Tarjeta rechazada",
    });
    await expect(culqi.reembolsar("chr_9", 99.99, "solicitud del cliente")).resolves.toMatchObject({ aprobado: false });
    expect(JSON.parse((fetch.mock.calls[1] as unknown as [string, RequestInit])[1].body as string)).toEqual({ amount: 9999, charge_id: "chr_9", reason: "solicitud del cliente" });
  });
});
