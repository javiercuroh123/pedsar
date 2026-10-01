import { headers } from "next/headers";
import { describe, expect, it, vi } from "vitest";
import { registrarActividad } from "@/lib/auditoria";
import { getUsuarioActual, requireRol, requireUsuario } from "@/lib/auth";
import { generarCodigoCertificado } from "@/lib/certificados";
import { entorno, perfil, Redireccion, responder, UUID } from "../../apoyo/entorno";

describe("código de certificado", () => {
  it("tiene el formato PED-AAAA-XXXXXXXX sin caracteres ambiguos", () => {
    const codigo = generarCodigoCertificado(new Date("2026-03-15T12:00:00Z"));
    expect(codigo).toMatch(/^PED-2026-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
  });

  it("no se repite en miles de emisiones", () => {
    const codigos = new Set(Array.from({ length: 5000 }, () => generarCodigoCertificado()));
    expect(codigos.size).toBe(5000);
  });
});

describe("sesión y roles (lib/auth)", () => {
  const conClaims = (sub: string | null, fila: unknown) => {
    responder({ perfiles: { data: fila } });
    entorno.servidor.cliente.auth.getClaims.mockResolvedValue({ data: sub ? { claims: { sub } } : null, error: null });
  };

  it("lee el perfil del usuario autenticado", async () => {
    conClaims(UUID.estudiante, perfil("estudiante"));
    expect(await getUsuarioActual()).toMatchObject({ id: UUID.estudiante, rol: "estudiante" });
    expect(entorno.servidor.de("perfiles")[0].filtros).toContainEqual(["eq", "id", UUID.estudiante]);
  });

  it("sin sesión no consulta perfiles y redirige al login", async () => {
    conClaims(null, null);
    expect(await getUsuarioActual()).toBeNull();
    expect(entorno.servidor.consultas).toHaveLength(0);
    await expect(requireUsuario()).rejects.toEqual(new Redireccion("/login"));
  });

  it("una cuenta desactivada no puede entrar", async () => {
    conClaims(UUID.estudiante, perfil("estudiante", { estado: false }));
    await expect(requireUsuario()).rejects.toMatchObject({ destino: "/login?error=cuenta-inactiva" });
  });

  it("con otro rol, envía al usuario a su propio panel", async () => {
    conClaims(UUID.estudiante, perfil("estudiante"));
    await expect(requireRol("administrador")).rejects.toMatchObject({ destino: "/estudiante" });
    conClaims(UUID.instructor, perfil("instructor"));
    await expect(requireRol("instructor", "administrador")).resolves.toMatchObject({ rol: "instructor" });
  });
});

describe("auditoría (HU-61)", () => {
  it("registra la acción con la IP del cliente", async () => {
    await registrarActividad(UUID.admin, "CONFIRMAR_PAGO", { inscripcion: "MAT-1" });
    expect(entorno.admin.de("registro_actividad", "insert")[0].valores).toEqual({
      usuario_id: UUID.admin,
      accion: "CONFIRMAR_PAGO",
      detalle: { inscripcion: "MAT-1" },
      direccion_ip: "203.0.113.7",
    });
  });

  it("sin cabecera de IP ni detalle guarda null", async () => {
    vi.mocked(headers).mockResolvedValueOnce(new Headers() as never);
    await registrarActividad(null, "VENCER_RESERVA");
    expect(entorno.admin.de("registro_actividad")[0].valores).toMatchObject({ detalle: null, direccion_ip: null });
  });

  it("nunca interrumpe la acción si falla", async () => {
    responder({}, { registro_actividad: { error: { message: "sin permiso" } } });
    await expect(registrarActividad(UUID.admin, "X")).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledWith("No se pudo registrar la actividad:", "sin permiso");

    entorno.admin.cliente.from = () => {
      throw new Error("sin conexión");
    };
    await expect(registrarActividad(UUID.admin, "X")).resolves.toBeUndefined();
    expect(console.error).toHaveBeenLastCalledWith("No se pudo registrar la actividad:", "sin conexión");
  });
});
