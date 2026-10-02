import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { GET as confirmarCorreo } from "@/app/auth/confirm/route";
import { GET as exportarReporte } from "@/app/admin/reportes/exportar/route";
import { GET as salud } from "@/app/api/salud/route";
import { POST as webhook } from "@/app/api/pagos/webhook/[proveedor]/route";
import { GET as pdfCertificado } from "@/app/certificados/[codigo]/pdf/route";
import { GET as pdfComprobante } from "@/app/comprobantes/[id]/pdf/route";
import { GET as exportarDatos } from "@/app/cuenta/exportar/route";
import { GET as exportarReporteCurso } from "@/app/instructor/notas/exportar/route";
import { leerPdf, leerXlsx } from "../../apoyo/archivos";
import { conSesion, entorno, Redireccion, responder, UUID } from "../../apoyo/entorno";

vi.mock("@/lib/auth", () => import("../../apoyo/auth-falso"));

// El webhook exige la clave secreta; se fija antes de importar la ruta.
const { pasarelaFalsa, confirmarPagoFalso } = vi.hoisted(() => {
  process.env.CULQI_WEBHOOK_SECRET = "secreto-de-prueba";
  return {
    pasarelaFalsa: {
      leerWebhook: vi.fn((cuerpo: string): { tipo: "orden" | "cargo"; id: string } | null => ({ tipo: "orden", id: JSON.parse(cuerpo).data.id })),
      consultar: vi.fn(),
    },
    confirmarPagoFalso: vi.fn(async () => "CONFIRMADO"),
  };
});
vi.mock("@/lib/pagos", async (original) => ({ ...(await original<typeof import("@/lib/pagos")>()), getPasarela: () => pasarelaFalsa }));
vi.mock("@/features/matricula/confirmar-pago", () => ({ confirmarPago: confirmarPagoFalso }));

const contexto = <T,>(params: T) => ({ params: Promise.resolve(params) }) as never;
const pedido = (ruta: string, init?: RequestInit) => new NextRequest(`https://pedsar.test${ruta}`, init as never);

describe("webhook de pagos verificado contra la pasarela (secuencia de pago, pasos 19-22)", () => {
  const aviso = (clave: string | null = "secreto-de-prueba", cuerpo = '{"type":"order.status.changed","data":{"id":"ord_1"}}') =>
    pedido(`/api/pagos/webhook/culqi${clave === null ? "" : `?clave=${clave}`}`, { method: "POST", body: cuerpo });
  const culqi = contexto({ proveedor: "culqi" });
  const PAGADA = { estado: "PAGADO", pagoId: UUID.pago, montoCentimos: 14400, medio: "BILLETERA", referencia: "ord_1", respuesta: { id: "ord_1" } };
  const PAGO = { data: { id: UUID.pago, monto: 144 } };

  it("rechaza proveedores desconocidos y avisos sin la clave secreta correcta", async () => {
    expect((await webhook(pedido("/x", { method: "POST", body: "{}" }), contexto({ proveedor: "paypal" }))).status).toBe(404);
    expect((await webhook(aviso(null), culqi)).status).toBe(401);
    expect((await webhook(aviso("otra-clave"), culqi)).status).toBe(401);
    expect(pasarelaFalsa.consultar).not.toHaveBeenCalled();
    expect(entorno.admin.consultas).toHaveLength(0);
  });

  it("sin secreto configurado no acepta ningún aviso", async () => {
    vi.stubEnv("CULQI_WEBHOOK_SECRET", "");
    vi.resetModules();
    const { POST } = await import("@/app/api/pagos/webhook/[proveedor]/route");
    expect((await POST(aviso(""), culqi)).status).toBe(401);
    vi.unstubAllEnvs();
  });

  it("ignora los eventos que no indican una orden o un cargo", async () => {
    pasarelaFalsa.leerWebhook.mockReturnValueOnce(null);
    const r = await webhook(aviso(), culqi);
    expect(await r.json()).toEqual({ recibido: true });
    expect(pasarelaFalsa.consultar).not.toHaveBeenCalled();
  });

  it("confirma el pago solo después de consultar la orden en la API y comprobar el monto (con cupón)", async () => {
    pasarelaFalsa.consultar.mockResolvedValueOnce(PAGADA);
    responder({}, { pagos: PAGO });
    expect((await webhook(aviso(), culqi)).status).toBe(200);
    expect(pasarelaFalsa.consultar).toHaveBeenCalledWith({ tipo: "orden", id: "ord_1" });
    expect(entorno.admin.de("pagos")[0].filtros).toEqual([["eq", "id", UUID.pago]]);
    expect(confirmarPagoFalso).toHaveBeenCalledWith(UUID.pago, { referencia: "ord_1", medio: "BILLETERA", respuesta: { id: "ord_1" }, actor: null });
  });

  it("sin la referencia del pago en la metadata, lo busca por la orden", async () => {
    pasarelaFalsa.consultar.mockResolvedValueOnce({ ...PAGADA, pagoId: null });
    responder({}, { pagos: PAGO });
    await webhook(aviso(), culqi);
    expect(entorno.admin.de("pagos")[0].filtros).toEqual([["eq", "orden_pasarela", "ord_1"]]);
    expect(confirmarPagoFalso).toHaveBeenCalledTimes(1);
  });

  it("no confirma un pago cuyo monto no coincide y lo deja en la auditoría", async () => {
    pasarelaFalsa.consultar.mockResolvedValueOnce({ ...PAGADA, montoCentimos: 14000 });
    responder({}, { pagos: PAGO });
    expect((await webhook(aviso(), culqi)).status).toBe(200);
    expect(confirmarPagoFalso).not.toHaveBeenCalled();
    expect(entorno.admin.de("registro_actividad")[0].valores).toMatchObject({ accion: "PAGO_MONTO_DISTINTO", detalle: { esperado: 14400, recibido: 14000 } });
  });

  it.each(["PENDIENTE", "EXPIRADO", "RECHAZADO"])("no confirma una orden %s", async (estado) => {
    pasarelaFalsa.consultar.mockResolvedValueOnce({ ...PAGADA, estado });
    expect((await webhook(aviso(), culqi)).status).toBe(200);
    expect(confirmarPagoFalso).not.toHaveBeenCalled();
  });

  it("no confirma pagos que no existen", async () => {
    pasarelaFalsa.consultar.mockResolvedValueOnce(PAGADA);
    responder({}, { pagos: { data: null } });
    expect((await webhook(aviso(), culqi)).status).toBe(200);
    expect(confirmarPagoFalso).not.toHaveBeenCalled();
  });

  it("si la BD falla al confirmar, responde 500 para que Culqi reintente", async () => {
    pasarelaFalsa.consultar.mockResolvedValueOnce(PAGADA);
    responder({}, { pagos: PAGO });
    confirmarPagoFalso.mockRejectedValueOnce(new Error("No se pudo aprobar el pago: conexión perdida"));
    const r = await webhook(aviso(), culqi);
    expect(r.status).toBe(500);
  });

  it("si no puede consultar la pasarela responde 500 para que Culqi reintente", async () => {
    pasarelaFalsa.consultar.mockRejectedValueOnce(new Error("No pudimos conectar con la pasarela de pagos"));
    expect((await webhook(aviso(), culqi)).status).toBe(500);
    expect(confirmarPagoFalso).not.toHaveBeenCalled();
  });
});

describe("PDF del comprobante: GET /comprobantes/[id]/pdf", () => {
  const COMPROBANTE = {
    id: 41,
    serie: "CP01",
    numero: "000123",
    fecha_emision: "2026-10-02",
    tipo: "BOLETA",
    cliente_nombre: "Ana Quispe",
    cliente_documento: "71234567",
    ruc: null,
    razon_social: null,
    concepto: "Excel",
    subtotal: "180.00",
    descuento: "36.00",
    total: "144.00",
    metodo: "CULQI",
    medio: "TARJETA",
    referencia_pasarela: "chr_test_1",
  };

  it("pide iniciar sesión", async () => {
    await expect(pdfComprobante(pedido("/comprobantes/41/pdf"), contexto({ id: "41" }))).rejects.toBeInstanceOf(Redireccion);
  });

  it("RLS decide: un comprobante ajeno, inexistente o con id no válido da 404", async () => {
    conSesion("estudiante");
    expect((await pdfComprobante(pedido("/comprobantes/41/pdf"), contexto({ id: "41" }))).status).toBe(404);
    expect(entorno.servidor.de("comprobantes")[0].filtros).toEqual([["eq", "id", 41]]);
    expect((await pdfComprobante(pedido("/comprobantes/x/pdf"), contexto({ id: "x" }))).status).toBe(404);
  });

  it("descarga el comprobante propio con su número", async () => {
    conSesion("estudiante");
    responder({ comprobantes: { data: COMPROBANTE } });
    const r = await pdfComprobante(pedido("/comprobantes/41/pdf"), contexto({ id: "41" }));
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("application/pdf");
    expect(r.headers.get("content-disposition")).toBe('attachment; filename="comprobante-CP01-000123.pdf"');
    expect(r.headers.get("cache-control")).toBe("private, no-store");
    const { texto } = await leerPdf(new Uint8Array(await r.arrayBuffer()));
    expect(texto.replace(/\s+/g, " ")).toContain("Culqi · Tarjeta");
  });
});

describe("PDF del certificado: GET /certificados/[codigo]/pdf", () => {
  it("exige sesión", async () => {
    await expect(pdfCertificado(pedido("/certificados/x/pdf"), contexto({ codigo: "x" }))).rejects.toBeInstanceOf(Redireccion);
  });

  it("RLS decide: si no lo puede ver, 404", async () => {
    conSesion("estudiante");
    const r = await pdfCertificado(pedido("/certificados/x/pdf"), contexto({ codigo: " ped-2026-abcdefgh " }));
    expect(r.status).toBe(404);
    expect(entorno.servidor.de("certificados")[0].filtros).toEqual([["eq", "codigo_unico", "PED-2026-ABCDEFGH"]]);
  });

  it("genera el PDF con los datos congelados o, en certificados antiguos, los actuales", async () => {
    conSesion("estudiante");
    responder({
      certificados: {
        data: {
          codigo_unico: "PED-2026-ABCDEFGH",
          fecha_emision: "2026-09-30",
          estudiante_nombre: null,
          curso_titulo: null,
          duracion_horas: null,
          instructor_nombre: null,
          nota_final: "14.50",
          inscripcion: { estudiante: { nombres: "Ana", apellidos: "Quispe" }, curso: { titulo: "Excel", duracion_horas: 24 } },
        },
      },
    });
    const r = await pdfCertificado(pedido("/certificados/x/pdf"), contexto({ codigo: "PED-2026-ABCDEFGH" }));
    expect(r.headers.get("content-type")).toBe("application/pdf");
    expect(r.headers.get("content-disposition")).toBe('attachment; filename="certificado-PED-2026-ABCDEFGH.pdf"');
    expect(r.headers.get("cache-control")).toBe("private, no-store");
    const { texto } = await leerPdf(new Uint8Array(await r.arrayBuffer()));
    expect(texto).toContain("Ana Quispe");
    expect(texto).toContain("24 horas académicas y una nota final de 14.5 sobre 20");
  });
});

describe("exportaciones", () => {
  const reporteVacio = () => responder({ cursos: { data: [] }, inscripciones: { data: [] }, perfiles: { count: 0 } });

  it("el reporte general es solo para el administrador", async () => {
    conSesion("instructor");
    expect((await exportarReporte(pedido("/admin/reportes/exportar"))).status).toBe(403);
  });

  it("valida fechas y curso, exporta xlsx o pdf y lo audita", async () => {
    conSesion("administrador");
    reporteVacio();
    const r = await exportarReporte(pedido("/admin/reportes/exportar?formato=xlsx&desde=2026-09-01&hasta=2026-09-30&curso=no-uuid"));
    expect(r.headers.get("content-disposition")).toBe('attachment; filename="reporte-pedsar-2026-09-01_2026-09-30.xlsx"');
    expect(leerXlsx(Buffer.from(await r.arrayBuffer())).hojas).toHaveLength(4);
    expect(entorno.servidor.de("cursos")[0].filtros.some((f) => f[0] === "eq")).toBe(false);
    expect(entorno.admin.de("registro_actividad")[0].valores).toMatchObject({ accion: "EXPORTAR_REPORTE", detalle: { formato: "xlsx", desde: "2026-09-01" } });

    reporteVacio();
    const pdf = await exportarReporte(pedido(`/admin/reportes/exportar?formato=pdf&desde=01/09/2026&curso=${UUID.curso}`));
    expect(pdf.headers.get("content-type")).toBe("application/pdf");
    expect(pdf.headers.get("content-disposition")).toMatch(/reporte-pedsar-\d{4}-01-01_\d{4}-\d{2}-\d{2}\.pdf/);
    expect(entorno.servidor.de("cursos")[0].filtros).toContainEqual(["eq", "id", UUID.curso]);
  });

  it("el reporte del curso solo para su instructor", async () => {
    conSesion("instructor");
    responder({ cursos: { data: [{ id: UUID.curso, titulo: "Excel Avanzado 2026", categoria: null }] }, evaluaciones: { data: [] }, sesiones: { data: [] } }, { inscripciones: { data: [] } });
    expect((await exportarReporteCurso(pedido(`/instructor/notas/exportar?curso=${UUID.otra}`))).status).toBe(404);
    const r = await exportarReporteCurso(pedido(`/instructor/notas/exportar?curso=${UUID.curso}&formato=pdf`));
    expect(r.headers.get("content-disposition")).toMatch(/^attachment; filename="reporte-excel-avanzado-2026-\d{4}-\d{2}-\d{2}\.pdf"$/);
    const xlsx = await exportarReporteCurso(pedido(`/instructor/notas/exportar?curso=${UUID.curso}`));
    expect(xlsx.headers.get("content-disposition")).toMatch(/\.xlsx"$/);
    expect(entorno.admin.de("registro_actividad").map((c) => (c.valores as { detalle: { formato: string } }).detalle.formato)).toEqual(["pdf", "xlsx"]);
  });

  it("exporta los datos personales del usuario (Ley N.º 29733)", async () => {
    expect((await exportarDatos()).status).toBe(401);
    conSesion("estudiante");
    responder({
      perfiles: { data: { nombres: "Ana" } },
      inscripciones: { data: [{ codigo: "MAT-1" }] },
      notificaciones: { data: [] },
      mensajes: { data: [{ texto: "¿Hasta cuándo?", enviado_en: "2026-10-02T14:00:00Z" }] },
      resenas: { data: [{ estrellas: 5, texto: "Muy práctico" }] },
    });
    const r = await exportarDatos();
    expect(r.headers.get("content-disposition")).toBe('attachment; filename="mis-datos-pedsar.json"');
    expect(await r.json()).toMatchObject({
      perfil: { nombres: "Ana" },
      inscripciones: [{ codigo: "MAT-1" }],
      notificaciones: [],
      mensajes: [{ texto: "¿Hasta cuándo?" }],
      resenas: [{ estrellas: 5, texto: "Muy práctico" }],
    });
    expect(entorno.servidor.de("inscripciones")[0].filtros).toEqual([["eq", "estudiante_id", UUID.estudiante]]);
    // Solo los mensajes que escribió el usuario: los del otro participante son datos de otra persona.
    expect(entorno.servidor.de("mensajes")[0].filtros).toEqual([["eq", "autor_id", UUID.estudiante]]);
    expect(entorno.servidor.de("resenas")[0].filtros).toEqual([["eq", "estudiante_id", UUID.estudiante]]);
  });
});

describe("salud y verificación de correo", () => {
  it("el health check responde 200 o 503 según la base de datos", async () => {
    const ok = await salud();
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ estado: "ok", baseDeDatos: true });
    responder({ categorias: { error: { message: "caída" } } });
    expect((await salud()).status).toBe(503);
  });

  it("confirma el enlace de Supabase Auth y solo redirige dentro del sitio", async () => {
    const r = await confirmarCorreo(pedido("/auth/confirm?token_hash=abc&type=email&next=/cuenta/nueva-contrasena"));
    expect(entorno.servidor.cliente.auth.verifyOtp).toHaveBeenCalledWith({ type: "email", token_hash: "abc" });
    expect(r.headers.get("location")).toBe("https://pedsar.test/cuenta/nueva-contrasena");
    expect((await confirmarCorreo(pedido("/auth/confirm?token_hash=abc&type=email&next=//evil.com"))).headers.get("location")).toBe("https://pedsar.test/");
    entorno.servidor.cliente.auth.verifyOtp.mockResolvedValueOnce({ data: {}, error: { message: "expirado" } } as never);
    expect((await confirmarCorreo(pedido("/auth/confirm?token_hash=abc&type=email"))).headers.get("location")).toBe("https://pedsar.test/login?error=enlace-invalido");
    expect((await confirmarCorreo(pedido("/auth/confirm"))).headers.get("location")).toBe("https://pedsar.test/login?error=enlace-invalido");
  });
});
