import { describe, expect, it, vi } from "vitest";
import { GET as cronRecordatorios } from "@/app/api/cron/recordatorios/route";
import { enviarRecordatoriosPendientes } from "@/features/notificaciones/enviar";
import { enviarCorreo } from "@/lib/email";
import { entorno, responder, UUID } from "../../apoyo/entorno";

// La ruta exige CRON_SECRET; se fija antes de importar @/lib/env.server.
vi.hoisted(() => {
  process.env.CRON_SECRET = "secreto-cron";
});

vi.mock("@/lib/email", async (original) => ({
  ...(await original<typeof import("@/lib/email")>()),
  enviarCorreo: vi.fn(async () => ({ ok: true, simulado: true })),
}));

const ahora = new Date("2026-10-10T18:00:00-05:00");

const sesion = (extra: Record<string, unknown> = {}) => ({
  id: 10,
  curso_id: UUID.curso,
  fecha: "2026-10-10",
  hora_inicio: "19:00:00",
  modalidad: "VIRTUAL",
  curso: { titulo: "Excel Avanzado", estado: "PUBLICADO" },
  ...extra,
});

const evaluacion = {
  id: 20,
  curso_id: UUID.curso,
  titulo: "Examen Final",
  fecha_limite: "2026-10-11T12:00:00-05:00",
  curso: { titulo: "Excel Avanzado", estado: "PUBLICADO" },
};

const inscrito = (canal: string, extra: Record<string, unknown> = {}) => ({
  id: UUID.inscripcion,
  estudiante_id: UUID.estudiante,
  estudiante: { nombres: "Ana", correo: "ana@pedsar.test", estado: true, canal_notificacion: canal },
  intentos_evaluacion: [],
  ...extra,
});

describe("recordatorios por correo (HU-21 · HU-40 · RF-11)", () => {
  it("envía el correo 1 h antes de la sesión y 24 h antes de la evaluación, con marcas propias", async () => {
    responder(
      {},
      {
        "sesiones.select": { data: [sesion(), sesion({ id: 11, hora_inicio: "21:00:00" })] },
        "evaluaciones.select": { data: [evaluacion] },
        "inscripciones.select": [{ data: [inscrito("AMBOS")] }, { data: [inscrito("CORREO")] }],
      },
    );

    await expect(enviarRecordatoriosPendientes(ahora)).resolves.toEqual({ sesiones: 1, evaluaciones: 1, fallidos: 0 });

    // HU-16 · las sesiones asíncronas no llevan recordatorio de inicio.
    expect(entorno.admin.de("sesiones", "select")[0].filtros).toEqual([
      ["in", "fecha", ["2026-10-10"]],
      ["neq", "modalidad", "ASINCRONA"],
    ]);
    expect(entorno.admin.de("recordatorios_enviados", "insert").map((c) => c.valores)).toEqual([
      { usuario_id: UUID.estudiante, tipo_evento: "SESION_1H_CORREO", referencia_id: 10 },
      { usuario_id: UUID.estudiante, tipo_evento: "EVALUACION_24H_CORREO", referencia_id: 20 },
    ]);
    // El aviso in-app lo crea la base (privado.generar_recordatorios_programados), no esta función.
    expect(entorno.admin.de("notificaciones", "insert")).toHaveLength(0);
    expect(enviarCorreo).toHaveBeenCalledTimes(2);
    expect(vi.mocked(enviarCorreo).mock.calls.map(([c]) => [c.para, c.asunto])).toEqual([
      ["ana@pedsar.test", "Recordatorio: tu sesión de Excel Avanzado inicia pronto"],
      ["ana@pedsar.test", "Recordatorio: evaluación pendiente en Excel Avanzado"],
    ]);
    expect(vi.mocked(enviarCorreo).mock.calls[1][0].html).toContain("Examen Final");
  });

  it("cerca de medianoche también busca las sesiones del día siguiente", async () => {
    responder({}, { "sesiones.select": { data: [sesion({ fecha: "2026-10-11", hora_inicio: "00:30:00" })] }, "inscripciones.select": { data: [inscrito("AMBOS")] } });

    await expect(enviarRecordatoriosPendientes(new Date("2026-10-10T23:30:00-05:00"))).resolves.toMatchObject({ sesiones: 1 });
    expect(entorno.admin.de("sesiones", "select")[0].filtros[0]).toEqual(["in", "fecha", ["2026-10-10", "2026-10-11"]]);
  });

  it("no envía a quien eligió solo avisos in-app, ni a cuentas inactivas, sin correo o que ya rindieron", async () => {
    responder(
      {},
      {
        "sesiones.select": { data: [sesion(), sesion({ id: 12, curso: { titulo: "Borrador", estado: "BORRADOR" } })] },
        "evaluaciones.select": { data: [evaluacion] },
        "inscripciones.select": [
          {
            data: [
              inscrito("IN_APP"),
              inscrito("AMBOS", { estudiante: { nombres: "Luis", correo: "luis@pedsar.test", estado: false } }),
              inscrito("AMBOS", { estudiante: { nombres: "Rosa", correo: null, estado: true } }),
            ],
          },
          { data: [inscrito("AMBOS", { intentos_evaluacion: [{ evaluacion_id: 20 }] })] },
        ],
      },
    );

    await expect(enviarRecordatoriosPendientes(ahora)).resolves.toEqual({ sesiones: 0, evaluaciones: 0, fallidos: 0 });
    expect(entorno.admin.de("recordatorios_enviados", "insert")).toHaveLength(0);
    expect(enviarCorreo).not.toHaveBeenCalled();
  });

  it("no repite un correo ya enviado (la marca única ya existe)", async () => {
    responder(
      {},
      {
        "sesiones.select": { data: [sesion()] },
        "inscripciones.select": { data: [inscrito("AMBOS")] },
        "recordatorios_enviados.insert": { error: { code: "23505", message: "duplicate key" } },
      },
    );

    await expect(enviarRecordatoriosPendientes(ahora)).resolves.toEqual({ sesiones: 0, evaluaciones: 0, fallidos: 0 });
    expect(enviarCorreo).not.toHaveBeenCalled();
  });

  it("si el envío falla, borra la marca para reintentarlo en la siguiente vuelta", async () => {
    vi.mocked(enviarCorreo).mockRejectedValueOnce(new Error("Resend: rate limit"));
    responder({}, { "sesiones.select": { data: [sesion()] }, "inscripciones.select": { data: [inscrito("CORREO")] } });

    await expect(enviarRecordatoriosPendientes(ahora)).resolves.toEqual({ sesiones: 0, evaluaciones: 0, fallidos: 1 });
    expect(entorno.admin.de("recordatorios_enviados", "delete")[0].filtros).toEqual([
      ["match", { usuario_id: UUID.estudiante, tipo_evento: "SESION_1H_CORREO", referencia_id: 10 }],
    ]);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("No se pudo enviar el recordatorio"), "Resend: rate limit");
  });
});

describe("GET /api/cron/recordatorios", () => {
  const pedido = (autorizacion?: string) =>
    new Request("https://pedsar.test/api/cron/recordatorios", { headers: autorizacion ? { authorization: autorizacion } : {} });

  it("rechaza las llamadas sin la clave correcta", async () => {
    expect((await cronRecordatorios(pedido())).status).toBe(401);
    expect((await cronRecordatorios(pedido("Bearer otra"))).status).toBe(401);
    expect((await cronRecordatorios(pedido("secreto-cron"))).status).toBe(401);
    expect(entorno.admin.consultas).toHaveLength(0);
  });

  it("con la clave correcta envía los recordatorios y devuelve el resumen", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(ahora);
    responder({}, { "sesiones.select": { data: [sesion()] }, "inscripciones.select": { data: [inscrito("AMBOS")] } });
    const r = await cronRecordatorios(pedido("Bearer secreto-cron"));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, sesiones: 1, evaluaciones: 0, fallidos: 0 });
  });

  it("si la base falla responde 500", async () => {
    responder({}, { "sesiones.select": () => { throw new Error("sin conexión"); } });
    const r = await cronRecordatorios(pedido("Bearer secreto-cron"));
    expect(r.status).toBe(500);
    expect(console.error).toHaveBeenCalledWith("Recordatorios por correo:", "sin conexión");
  });
});
