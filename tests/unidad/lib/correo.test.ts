import { describe, expect, it, vi } from "vitest";
import { enviarCorreo, programarCorreo } from "@/lib/email";
import {
  correoCertificadoEmitido,
  correoConfirmacionMatricula,
  correoInscripcionRegistrada,
  correoPagoObservado,
  correoPagoRechazado,
} from "@/lib/email/plantillas";
import { ejecutarTareas, entorno } from "../../apoyo/entorno";

describe("plantillas de correo (HU-21)", () => {
  const inscripcion = {
    nombre: "Ana",
    curso: "Excel <avanzado>",
    codigo: "MAT-AB12CD34",
    monto: "S/ 180.00",
    app: "Yape" as const,
    celular: "956 000 000",
    titular: "PEDSAR E.I.R.L.",
    venceEn: "3 oct. 2026, 10:30",
    url: "https://pedsar.test/estudiante/pagos",
  };

  it("la inscripción incluye monto, celular, plazo y enlace a Pagos", () => {
    const { asunto, html } = correoInscripcionRegistrada(inscripcion);
    expect(asunto).toContain("Excel <avanzado>");
    for (const dato of ["S/ 180.00", "956 000 000", "PEDSAR E.I.R.L.", "3 oct. 2026, 10:30", "MAT-AB12CD34", 'href="https://pedsar.test/estudiante/pagos"']) {
      expect(html).toContain(dato);
    }
  });

  it("escapa todo texto variable (sin HTML inyectado)", () => {
    const { html } = correoPagoObservado({
      nombre: '<img src=x onerror="alert(1)">',
      curso: "Excel & Power BI",
      motivo: "La captura no coincide <b>",
      venceEn: "mañana",
      url: "https://pedsar.test/estudiante/pagos",
    });
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(html).toContain("Excel &amp; Power BI");
    expect(html).toContain("La captura no coincide &lt;b&gt;");
  });

  it("cada evento tiene su asunto y su enlace", () => {
    const datos = { nombre: "Ana", curso: "Excel", codigo: "MAT-1", url: "https://pedsar.test/x" };
    const correos = [correoConfirmacionMatricula(datos), correoPagoRechazado(datos), correoCertificadoEmitido({ ...datos, codigo: "PED-2026-ABCDEFGH" })];
    expect(new Set(correos.map((c) => c.asunto)).size).toBe(3);
    correos.forEach((c) => expect(c.html).toContain('href="https://pedsar.test/x"'));
    expect(correos[2].html).toContain("PED-2026-ABCDEFGH");
  });
});

describe("envío de correos", () => {
  it("sin RESEND_API_KEY solo lo muestra en la consola", async () => {
    await expect(enviarCorreo({ para: "ana@pedsar.test", asunto: "Hola", html: "<p>x</p>" })).resolves.toEqual({ ok: true, simulado: true });
    expect(console.info).toHaveBeenCalledWith("[correo simulado] → ana@pedsar.test: Hola");
  });

  it("programarCorreo lo envía después de responder y nunca lanza", async () => {
    programarCorreo({ para: "ana@pedsar.test", asunto: "Después", html: "" });
    expect(console.info).not.toHaveBeenCalled();
    expect(entorno.tareas).toHaveLength(1);
    await ejecutarTareas();
    expect(console.info).toHaveBeenCalledWith("[correo simulado] → ana@pedsar.test: Después");
  });

  it("con Resend configurado usa el remitente y reporta sus errores", async () => {
    const send = vi.fn().mockResolvedValueOnce({ error: null }).mockResolvedValue({ error: { message: "dominio no verificado" } });
    vi.doMock("resend", () => ({ Resend: vi.fn(function () { return { emails: { send } }; }) }));
    vi.stubEnv("RESEND_API_KEY", "re_prueba");
    vi.stubEnv("EMAIL_FROM", "PEDSAR <no-reply@pedsar.test>");
    vi.resetModules();
    try {
      const email = await import("@/lib/email");
      await expect(email.enviarCorreo({ para: "ana@pedsar.test", asunto: "A", html: "<p>a</p>" })).resolves.toEqual({ ok: true, simulado: false });
      expect(send).toHaveBeenCalledWith({ from: "PEDSAR <no-reply@pedsar.test>", to: "ana@pedsar.test", subject: "A", html: "<p>a</p>" });
      await expect(email.enviarCorreo({ para: "ana@pedsar.test", asunto: "B", html: "" })).rejects.toThrow("Resend: dominio no verificado");

      // Tras resetModules, se toma la tarea directamente del after() simulado que usó el módulo recién cargado.
      const { after } = await import("next/server");
      email.programarCorreo({ para: "ana@pedsar.test", asunto: "C", html: "" });
      const tarea = vi.mocked(after).mock.calls.at(-1)![0] as () => Promise<void>;
      await expect(tarea()).resolves.toBeUndefined();
      expect(console.error).toHaveBeenCalledWith("No se pudo enviar el correo «C»:", "Resend: dominio no verificado");
    } finally {
      vi.doUnmock("resend");
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });
});
