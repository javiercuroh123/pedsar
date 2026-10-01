import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { GET as confirmarCorreo } from "@/app/auth/confirm/route";
import { GET as exportarReporte } from "@/app/admin/reportes/exportar/route";
import { GET as salud } from "@/app/api/salud/route";
import { POST as webhook } from "@/app/api/pagos/webhook/[proveedor]/route";
import { GET as pdfCertificado } from "@/app/certificados/[codigo]/pdf/route";
import { GET as exportarDatos } from "@/app/cuenta/exportar/route";
import { GET as exportarReporteCurso } from "@/app/instructor/notas/exportar/route";
import { leerPdf, leerXlsx } from "../../apoyo/archivos";
import { conSesion, ejecutarTareas, entorno, Redireccion, responder, UUID } from "../../apoyo/entorno";

vi.mock("@/lib/auth", () => import("../../apoyo/auth-falso"));

const contexto = <T,>(params: T) => ({ params: Promise.resolve(params) }) as never;
const pedido = (ruta: string, init?: RequestInit) => new NextRequest(`https://pedsar.test${ruta}`, init as never);

describe("webhook de pagos (secuencia de pago, pasos 19-25)", () => {
  const evento = (type: string) => pedido("/api/pagos/webhook/culqi", { method: "POST", body: JSON.stringify({ type, data: { id: "chr_1" } }) });

  it("rechaza proveedores desconocidos e ignora eventos irrelevantes", async () => {
    expect((await webhook(pedido("/x", { method: "POST", body: "{}" }), contexto({ proveedor: "paypal" }))).status).toBe(404);
    const r = await webhook(evento("order.created"), contexto({ proveedor: "culqi" }));
    expect(await r.json()).toEqual({ recibido: true });
    expect(entorno.admin.consultas).toHaveLength(0);
  });

  it("un cargo aprobado confirma la inscripción y envía el correo de confirmación", async () => {
    responder(
      {},
      {
        "pagos.update": { data: { inscripcion_id: UUID.inscripcion } },
        "inscripciones.update": { data: { codigo: "MAT-1", estudiante: { nombres: "Ana", correo: "ana@pedsar.test" }, curso: { titulo: "Excel" } } },
      },
    );
    expect((await webhook(evento("charge.succeeded"), contexto({ proveedor: "culqi" }))).status).toBe(200);
    expect(entorno.admin.de("pagos", "update")[0]).toMatchObject({ valores: { estado: "APROBADO", fecha_pago: expect.any(String) }, filtros: [["eq", "referencia_pasarela", "chr_1"], ["select", "inscripcion_id"]] });
    expect(entorno.admin.de("inscripciones", "update")[0].valores).toEqual({ estado: "CONFIRMADA", vence_en: null });
    await ejecutarTareas();
    expect(console.info).toHaveBeenCalledWith(expect.stringContaining("ana@pedsar.test"));
  });

  it("un cargo rechazado cancela solo inscripciones pendientes (libera el cupo)", async () => {
    responder({}, { "pagos.update": { data: { inscripcion_id: UUID.inscripcion } } });
    await webhook(evento("charge.failed"), contexto({ proveedor: "culqi" }));
    expect(entorno.admin.de("pagos", "update")[0].valores).toMatchObject({ estado: "RECHAZADO", fecha_pago: null });
    expect(entorno.admin.de("inscripciones", "update")[0]).toMatchObject({ valores: { estado: "CANCELADA" }, filtros: [["eq", "id", UUID.inscripcion], ["eq", "estado", "PENDIENTE"]] });
    expect(entorno.tareas).toHaveLength(0);
  });

  it("informa errores de la BD y no toca inscripciones de pagos desconocidos", async () => {
    responder({}, { "pagos.update": [{ error: { message: "caído" } }, { data: null }] });
    const r = await webhook(evento("charge.succeeded"), contexto({ proveedor: "culqi" }));
    expect(r.status).toBe(500);
    await webhook(evento("charge.succeeded"), contexto({ proveedor: "culqi" }));
    expect(entorno.admin.de("inscripciones")).toHaveLength(0);
  });

  it("un reembolso de la pasarela cancela la inscripción", async () => {
    const pasarelas = await import("@/lib/pagos");
    vi.spyOn(pasarelas, "getPasarela").mockReturnValueOnce({ procesarWebhook: async () => ({ referencia: "chr_1", estado: "REEMBOLSADO", respuesta: {} }) } as never);
    responder({}, { "pagos.update": { data: { inscripcion_id: UUID.inscripcion } } });
    await webhook(evento("x"), contexto({ proveedor: "culqi" }));
    expect(entorno.admin.de("inscripciones", "update")[0]).toMatchObject({ valores: { estado: "CANCELADA" }, filtros: [["eq", "id", UUID.inscripcion]] });
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
    responder({ perfiles: { data: { nombres: "Ana" } }, inscripciones: { data: [{ codigo: "MAT-1" }] }, notificaciones: { data: [] } });
    const r = await exportarDatos();
    expect(r.headers.get("content-disposition")).toBe('attachment; filename="mis-datos-pedsar.json"');
    expect(await r.json()).toMatchObject({ perfil: { nombres: "Ana" }, inscripciones: [{ codigo: "MAT-1" }], notificaciones: [] });
    expect(entorno.servidor.de("inscripciones")[0].filtros).toEqual([["eq", "estudiante_id", UUID.estudiante]]);
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
