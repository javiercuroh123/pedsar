import { describe, expect, it, vi } from "vitest";
import { enviarContacto } from "@/features/contacto/acciones";
import { marcarLeida, marcarTodasLeidas } from "@/features/notificaciones/acciones";
import { contarNoLeidas, listarNotificaciones } from "@/features/notificaciones/consultas";
import { notificarUsuario } from "@/features/notificaciones/enviar";
import { actualizarContrasena, cerrarSesion, iniciarSesion, registrarse, solicitarRecuperacion } from "@/features/usuarios/acciones";
import { actualizarPerfil } from "@/features/usuarios/acciones-perfil";
import { conSesion, entorno, formulario, Redireccion, responder, UUID } from "../../apoyo/entorno";

vi.mock("@/lib/auth", () => import("../../apoyo/auth-falso"));

describe("inicio de sesión (HU-02)", () => {
  it("valida los campos y no revela si el correo existe", async () => {
    await expect(iniciarSesion({}, formulario({ correo: "x", contrasena: "" }))).resolves.toEqual({
      errores: { correo: ["Correo no válido"], contrasena: ["Ingresa tu contraseña"] },
    });
    entorno.servidor.cliente.auth.signInWithPassword.mockResolvedValueOnce({ data: { user: null }, error: { message: "Invalid login credentials" } } as never);
    await expect(iniciarSesion({}, formulario({ correo: "ana@pedsar.test", contrasena: "mala" }))).resolves.toEqual({ mensaje: "Correo o contraseña incorrectos" });
  });

  it("lleva a cada rol a su panel, o al destino interno pedido", async () => {
    responder({ perfiles: { data: { rol: "instructor" } } });
    await expect(iniciarSesion({}, formulario({ correo: "luis@pedsar.test", contrasena: "Clave123" }))).rejects.toEqual(new Redireccion("/instructor"));
    expect(entorno.admin.de("registro_actividad")[0].valores).toMatchObject({ usuario_id: "usuario", accion: "INICIO_SESION" });

    await expect(iniciarSesion({}, formulario({ correo: "a@pedsar.test", contrasena: "x", next: "/certificados/PED-1/pdf" }))).rejects.toEqual(new Redireccion("/certificados/PED-1/pdf"));
    // Evita redirecciones abiertas a otros sitios.
    responder();
    await expect(iniciarSesion({}, formulario({ correo: "a@pedsar.test", contrasena: "x", next: "//sitio-malicioso.com" }))).rejects.toEqual(new Redireccion("/estudiante"));
  });
});

describe("registro y contraseñas (HU-01 · HU-13)", () => {
  const registro = { nombres: "Ana", apellidos: "Quispe", correo: "ana@pedsar.test", contrasena: "Segura123", confirmar: "Segura123", aceptaPrivacidad: "on" };

  it("exige contraseña segura, confirmación y aceptar la política de privacidad", async () => {
    const r = await registrarse({}, formulario({ ...registro, contrasena: "corta", confirmar: "otra", aceptaPrivacidad: undefined }));
    expect(r.errores?.contrasena).toEqual(["Mínimo 8 caracteres", "Incluye una mayúscula", "Incluye un número"]);
    expect(r.errores?.aceptaPrivacidad).toEqual(["Debes aceptar la política de privacidad (Ley N° 29733)"]);
    const distinta = await registrarse({}, formulario({ ...registro, confirmar: "Segura124" }));
    expect(distinta.errores?.confirmar).toEqual(["Las contraseñas no coinciden"]);
  });

  it("registra con verificación por correo", async () => {
    await expect(registrarse({}, formulario(registro))).resolves.toEqual({ ok: true, mensaje: "Te enviamos un correo para verificar tu cuenta." });
    expect(entorno.servidor.cliente.auth.signUp).toHaveBeenCalledWith({
      email: "ana@pedsar.test",
      password: "Segura123",
      options: { data: { nombres: "Ana", apellidos: "Quispe" }, emailRedirectTo: "https://pedsar.test/auth/confirm" },
    });
    entorno.servidor.cliente.auth.signUp.mockResolvedValueOnce({ data: { user: null }, error: { message: "User already registered" } } as never);
    await expect(registrarse({}, formulario(registro))).resolves.toEqual({ mensaje: "User already registered" });
  });

  it("recupera y cambia la contraseña", async () => {
    await expect(solicitarRecuperacion({}, formulario({ correo: "x" }))).resolves.toMatchObject({ errores: { correo: ["Correo no válido"] } });
    await expect(solicitarRecuperacion({}, formulario({ correo: "ana@pedsar.test" }))).resolves.toMatchObject({ ok: true });
    expect(entorno.servidor.cliente.auth.resetPasswordForEmail).toHaveBeenCalledWith("ana@pedsar.test", { redirectTo: "https://pedsar.test/auth/confirm?next=/cuenta/nueva-contrasena" });

    await expect(actualizarContrasena({}, formulario({ contrasena: "Nueva1234", confirmar: "Nueva1234" }))).resolves.toEqual({ ok: true, mensaje: "Contraseña actualizada." });
    await expect(actualizarContrasena({}, formulario({ contrasena: "nueva", confirmar: "nueva" }))).resolves.toHaveProperty("errores");
    entorno.servidor.cliente.auth.updateUser.mockResolvedValueOnce({ data: { user: null }, error: { message: "misma contraseña" } } as never);
    await expect(actualizarContrasena({}, formulario({ contrasena: "Nueva1234", confirmar: "Nueva1234" }))).resolves.toEqual({ mensaje: "misma contraseña" });
  });

  it("cierra la sesión (HU-14)", async () => {
    await expect(cerrarSesion()).rejects.toEqual(new Redireccion("/login"));
    expect(entorno.servidor.cliente.auth.signOut).toHaveBeenCalled();
  });
});

describe("perfil (HU-15)", () => {
  const datos = { nombres: "Ana", apellidos: "Quispe", telefono: "", documento: "45678912", especialidad: "Excel", avatarUrl: "" };

  it("el estudiante no edita la especialidad y puede quitar su foto", async () => {
    conSesion("estudiante");
    await expect(actualizarPerfil({}, formulario(datos))).resolves.toEqual({ ok: true, mensaje: "Perfil actualizado" });
    expect(entorno.servidor.de("perfiles", "update")[0]).toMatchObject({
      valores: { nombres: "Ana", apellidos: "Quispe", telefono: null, documento: "45678912", avatar_url: null },
      filtros: [["eq", "id", UUID.estudiante]],
    });
    expect(entorno.servidor.de("perfiles", "update")[0].valores).not.toHaveProperty("especialidad");
  });

  it("el instructor sí edita la especialidad; se valida el documento", async () => {
    conSesion("instructor");
    responder({ perfiles: [{}, { error: { message: "x" } }] });
    await actualizarPerfil({}, formulario({ ...datos, avatarUrl: undefined }));
    expect(entorno.servidor.de("perfiles")[0].valores).toMatchObject({ especialidad: "Excel" });
    expect(entorno.servidor.de("perfiles")[0].valores).not.toHaveProperty("avatar_url");
    await expect(actualizarPerfil({}, formulario(datos))).resolves.toEqual({ ok: false, mensaje: "No se pudo guardar el perfil" });
    await expect(actualizarPerfil({}, formulario({ ...datos, documento: "123" }))).resolves.toEqual({ ok: false, mensaje: "DNI de 8 dígitos o CE válido" });
  });
});

describe("contacto (HU-48)", () => {
  const mensaje = { nombre: "Ana <b>", correo: "ana@pedsar.test", telefono: "987", asunto: "informes", mensaje: "Quisiera información\ndel curso de Excel" };

  it("envía el mensaje a la empresa escapando el contenido", async () => {
    await expect(enviarContacto({}, formulario(mensaje))).resolves.toMatchObject({ ok: true });
    expect(console.info).toHaveBeenCalledWith("[correo simulado] → informes@pedsar.pe: [Web · informes] Ana <b>");
    await expect(enviarContacto({}, formulario({ ...mensaje, mensaje: "corto" }))).resolves.toMatchObject({ errores: { mensaje: [expect.stringMatching(/mínimo 10/)] } });
  });

  it("si el correo falla, sugiere otro canal", async () => {
    const email = await import("@/lib/email");
    vi.spyOn(email, "enviarCorreo").mockRejectedValueOnce(new Error("Resend caído"));
    await expect(enviarContacto({}, formulario(mensaje))).resolves.toEqual({ mensaje: "No pudimos enviar tu mensaje. Inténtalo de nuevo o escríbenos por WhatsApp." });
  });
});

describe("notificaciones in-app (HU-51)", () => {
  it("lista, cuenta y marca como leídas solo las propias", async () => {
    responder({ "notificaciones.select": [{ data: [{ id: 1 }] }, { data: null }, { count: 3 }, { count: null }] });
    await expect(listarNotificaciones(UUID.estudiante, 5)).resolves.toEqual([{ id: 1 }]);
    expect(entorno.servidor.de("notificaciones")[0].filtros).toContainEqual(["limit", 5]);
    await expect(listarNotificaciones(UUID.estudiante)).resolves.toEqual([]);
    await expect(contarNoLeidas(UUID.estudiante)).resolves.toBe(3);
    await expect(contarNoLeidas(UUID.estudiante)).resolves.toBe(0);

    conSesion("estudiante");
    await marcarTodasLeidas();
    await marcarLeida(9);
    expect(entorno.servidor.de("notificaciones", "update").map((c) => c.filtros)).toEqual([
      [["eq", "usuario_id", UUID.estudiante], ["eq", "leida", false]],
      [["eq", "id", 9], ["eq", "usuario_id", UUID.estudiante]],
    ]);
  });

  it("el servidor crea la notificación con el cliente admin", async () => {
    await notificarUsuario(UUID.estudiante, "Hola");
    expect(entorno.admin.de("notificaciones", "insert")[0].valores).toEqual({ usuario_id: UUID.estudiante, mensaje: "Hola", enlace: null, tipo: "IN_APP" });
  });
});
