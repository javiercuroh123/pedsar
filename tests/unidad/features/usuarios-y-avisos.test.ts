import { describe, expect, it, vi } from "vitest";
import { enviarContacto } from "@/features/contacto/acciones";
import { actualizarCanalNotificacion, marcarLeida, marcarTodasLeidas } from "@/features/notificaciones/acciones";
import { contarNoLeidas, listarNotificaciones } from "@/features/notificaciones/consultas";
import { enviarRecordatoriosPendientes, notificarInscritosDelCurso, notificarUsuario } from "@/features/notificaciones/enviar";
import {
  aceptarTerminos,
  actualizarContrasena,
  cerrarSesion,
  iniciarConGoogle,
  iniciarSesion,
  registrarse,
  solicitarRecuperacion,
} from "@/features/usuarios/acciones";
import { actualizarPerfil } from "@/features/usuarios/acciones-perfil";
import { conSesion, ejecutarTareas, entorno, formulario, Redireccion, responder, UUID } from "../../apoyo/entorno";

vi.mock("@/lib/auth", () => import("../../apoyo/auth-falso"));

describe("inicio de sesión (HU-02)", () => {
  it("valida los campos y no revela si el correo existe", async () => {
    await expect(iniciarSesion({}, formulario({ correo: "x", contrasena: "" }))).resolves.toEqual({
      errores: { correo: ["Correo no válido"], contrasena: ["Ingresa tu contraseña"] },
    });
    entorno.servidor.cliente.auth.signInWithPassword.mockResolvedValueOnce({ data: { user: null }, error: { message: "Invalid login credentials" } } as never);
    await expect(iniciarSesion({}, formulario({ correo: "ana@pedsar.test", contrasena: "mala" }))).resolves.toEqual({ mensaje: "Correo o contraseña incorrectos" });
    // Un correo sin confirmar no es una contraseña equivocada.
    entorno.servidor.cliente.auth.signInWithPassword.mockResolvedValueOnce({ data: { user: null }, error: { message: "Email not confirmed", code: "email_not_confirmed" } } as never);
    await expect(iniciarSesion({}, formulario({ correo: "ana@pedsar.test", contrasena: "Clave123" }))).resolves.toEqual({
      mensaje: "Aún no confirmas tu correo. Abre el enlace que te enviamos para activar tu cuenta.",
    });
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

describe("login con Google (HU-45)", () => {
  it("envía a Google y pide volver a /auth/google con el destino interno", async () => {
    await expect(iniciarConGoogle(formulario({ next: "/cursos/excel" }))).rejects.toEqual(new Redireccion("https://accounts.google.test/o/oauth2/auth?estado=1"));
    expect(entorno.servidor.cliente.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: "https://pedsar.test/auth/google?next=%2Fcursos%2Fexcel", queryParams: { prompt: "select_account" } },
    });
  });

  it("desde el registro con la casilla marcada, envía la versión vigente de la política", async () => {
    await expect(iniciarConGoogle(formulario({ acepta: "on", next: "//sitio-malicioso.com" }))).rejects.toBeInstanceOf(Redireccion);
    expect(entorno.servidor.cliente.auth.signInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({ options: expect.objectContaining({ redirectTo: "https://pedsar.test/auth/google?acepta=2026-10" }) }),
    );
  });

  it("si Supabase no da la URL de Google, vuelve al login con un aviso", async () => {
    entorno.servidor.cliente.auth.signInWithOAuth.mockResolvedValueOnce({ data: { provider: "google", url: null }, error: { message: "provider is not enabled" } } as never);
    await expect(iniciarConGoogle(formulario({}))).rejects.toEqual(new Redireccion("/login?error=google"));
  });

  it("acepta los términos pendientes: exige la casilla y guarda versión y fecha", async () => {
    await expect(aceptarTerminos({}, formulario({}))).rejects.toEqual(new Redireccion("/login"));

    conSesion("estudiante");
    await expect(aceptarTerminos({}, formulario({}))).resolves.toEqual({ errores: { aceptaPrivacidad: ["Debes aceptar la política de privacidad (Ley N° 29733)"] } });
    expect(entorno.servidor.de("perfiles", "update")).toHaveLength(0);

    await expect(aceptarTerminos({}, formulario({ aceptaPrivacidad: "on", next: "/cursos/excel" }))).rejects.toEqual(new Redireccion("/cursos/excel"));
    const [cambio] = entorno.servidor.de("perfiles", "update");
    expect(cambio.valores).toEqual({ privacidad_version: "2026-10", privacidad_aceptada_en: expect.any(String) });
    expect(cambio.filtros).toContainEqual(["eq", "id", UUID.estudiante]);
    expect(entorno.admin.de("registro_actividad")[0].valores).toMatchObject({ usuario_id: UUID.estudiante, accion: "INICIO_SESION" });

    await expect(aceptarTerminos({}, formulario({ aceptaPrivacidad: "on", next: "//sitio-malicioso.com" }))).rejects.toEqual(new Redireccion("/estudiante"));
    responder({ "perfiles.update": { error: { message: "caída" } } });
    await expect(aceptarTerminos({}, formulario({ aceptaPrivacidad: "on" }))).resolves.toEqual({ mensaje: "No se pudo guardar tu aceptación. Inténtalo de nuevo." });
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

  it("registra con verificación por correo y evidencia de privacidad (HU-49)", async () => {
    await expect(registrarse({}, formulario(registro))).resolves.toEqual({ ok: true, mensaje: "Te enviamos un correo para verificar tu cuenta." });
    expect(entorno.servidor.cliente.auth.signUp).toHaveBeenCalledWith({
      email: "ana@pedsar.test",
      password: "Segura123",
      options: {
        data: {
          nombres: "Ana",
          apellidos: "Quispe",
          privacidad_version: "2026-10",
          privacidad_aceptada_en: expect.any(String),
        },
        emailRedirectTo: "https://pedsar.test/auth/confirm",
      },
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

  it("cierra la sesión y audita el evento si había usuario autenticado (HU-14 · HU-61)", async () => {
    await expect(cerrarSesion()).rejects.toEqual(new Redireccion("/login"));
    expect(entorno.servidor.cliente.auth.signOut).toHaveBeenCalled();

    conSesion("estudiante");
    await expect(cerrarSesion()).rejects.toEqual(new Redireccion("/login"));
    expect(entorno.admin.de("registro_actividad")[0].valores).toMatchObject({
      usuario_id: UUID.estudiante,
      accion: "CIERRE_SESION",
    });
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

  it("el instructor sí edita la especialidad; se valida el documento y la fecha de nacimiento", async () => {
    conSesion("instructor");
    responder({ perfiles: [{}, { error: { message: "x" } }] });
    await actualizarPerfil({}, formulario({ ...datos, fechaNacimiento: "1995-04-20", avatarUrl: undefined }));
    expect(entorno.servidor.de("perfiles")[0].valores).toMatchObject({ especialidad: "Excel", fecha_nacimiento: "1995-04-20" });
    expect(entorno.servidor.de("perfiles")[0].valores).not.toHaveProperty("avatar_url");
    await expect(actualizarPerfil({}, formulario(datos))).resolves.toEqual({ ok: false, mensaje: "No se pudo guardar el perfil" });
    await expect(actualizarPerfil({}, formulario({ ...datos, documento: "123" }))).resolves.toEqual({ ok: false, mensaje: "DNI de 8 dígitos o CE válido" });
    await expect(actualizarPerfil({}, formulario({ ...datos, fechaNacimiento: "no-fecha" }))).resolves.toEqual({ ok: false, mensaje: "Fecha de nacimiento no válida" });
  });

  it("guarda el celular solo con dígitos y rechaza números que no son celulares peruanos", async () => {
    conSesion("estudiante");
    await actualizarPerfil({}, formulario({ ...datos, telefono: "+51 987 654 321" }));
    expect(entorno.servidor.de("perfiles", "update")[0].valores).toMatchObject({ telefono: "987654321" });
    for (const telefono of ["98765", "abc", "812 345 678"]) {
      await expect(actualizarPerfil({}, formulario({ ...datos, telefono }))).resolves.toEqual({
        ok: false,
        mensaje: "El celular debe tener 9 dígitos y empezar con 9",
      });
    }
  });
});

describe("contacto (HU-48)", () => {
  const mensaje = { nombre: "Ana <b>", correo: "ana@pedsar.test", telefono: "987 654 321", asunto: "informes", mensaje: "Quisiera información\ndel curso de Excel" };

  it("envía el mensaje a la empresa escapando el contenido", async () => {
    const email = await import("@/lib/email");
    const envio = vi.spyOn(email, "enviarCorreo");
    await expect(enviarContacto({}, formulario(mensaje))).resolves.toMatchObject({ ok: true });
    expect(console.info).toHaveBeenCalledWith("[correo simulado] → informes@pedsar.pe: [Web · informes] Ana <b>");
    expect(envio.mock.calls[0][0].html).toContain("· +51 987 654 321");
    await expect(enviarContacto({}, formulario({ ...mensaje, mensaje: "corto" }))).resolves.toMatchObject({ errores: { mensaje: [expect.stringMatching(/mínimo 10/)] } });
  });

  it("el celular es opcional, pero si se escribe debe ser un celular peruano", async () => {
    await expect(enviarContacto({}, formulario({ ...mensaje, telefono: "" }))).resolves.toMatchObject({ ok: true });
    await expect(enviarContacto({}, formulario({ ...mensaje, telefono: "987" }))).resolves.toEqual({
      errores: { telefono: ["El celular debe tener 9 dígitos y empezar con 9"] },
    });
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

  it("el servidor crea la notificación con el cliente admin y avisa a los inscritos del curso (HU-21 · HU-41)", async () => {
    await notificarUsuario(UUID.estudiante, "Hola");
    expect(entorno.admin.de("notificaciones", "insert")[0].valores).toEqual({ usuario_id: UUID.estudiante, mensaje: "Hola", enlace: null, tipo: "IN_APP" });

    responder(
      {},
      {
        inscripciones: {
          data: [
            { estudiante_id: UUID.estudiante, estudiante: { nombres: "Ana", correo: "ana@pedsar.test", canal_notificacion: "AMBOS" }, curso: { titulo: "Excel" } },
            { estudiante_id: UUID.estudiante, estudiante: { nombres: "Ana", correo: "ana@pedsar.test", canal_notificacion: "AMBOS" }, curso: { titulo: "Excel" } },
          ],
        },
      },
    );
    await notificarInscritosDelCurso(UUID.curso, "Nueva evaluación", "/estudiante/evaluaciones/1");
    expect(entorno.admin.de("notificaciones", "insert")[0].valores).toEqual([
      { usuario_id: UUID.estudiante, mensaje: "Nueva evaluación", enlace: "/estudiante/evaluaciones/1", tipo: "IN_APP" },
    ]);
    expect(entorno.tareas).toHaveLength(1);
    await ejecutarTareas();
  });

  it("actualiza la preferencia de canal de notificaciones y envía recordatorios 1 h y 24 h antes (HU-21 · HU-41 · RF-11)", async () => {
    conSesion("estudiante");
    responder({ "perfiles.update": [{}, { error: { message: "fallo" } }] });
    await expect(actualizarCanalNotificacion(formulario({ canal: "CORREO" }))).resolves.toEqual({
      ok: true,
      mensaje: "Preferencia de notificaciones actualizada",
    });
    expect(entorno.servidor.de("perfiles", "update")[0]).toMatchObject({
      valores: { canal_notificacion: "CORREO" },
      filtros: [["eq", "id", UUID.estudiante]],
    });
    await expect(actualizarCanalNotificacion(formulario({ canal: "IN_APP" }))).resolves.toEqual({
      ok: false,
      mensaje: "No se pudo actualizar la preferencia",
    });
    await expect(actualizarCanalNotificacion(formulario({ canal: "SMS" }))).resolves.toMatchObject({ ok: false });

    const ahora = new Date("2026-10-10T18:00:00-05:00");
    responder(
      {},
      {
        "sesiones.select": {
          data: [
            {
              id: 10,
              curso_id: UUID.curso,
              fecha: "2026-10-10",
              hora_inicio: "19:00:00",
              modalidad: "VIRTUAL",
              curso: { titulo: "Excel Avanzado", estado: "PUBLICADO" },
            },
          ],
        },
        "evaluaciones.select": {
          data: [
            {
              id: 20,
              curso_id: UUID.curso,
              titulo: "Examen Final",
              fecha_limite: "2026-10-11T12:00:00-05:00",
              curso: { titulo: "Excel Avanzado", estado: "PUBLICADO" },
            },
          ],
        },
        "inscripciones.select": [
          {
            data: [
              {
                estudiante_id: UUID.estudiante,
                estudiante: { nombres: "Ana", correo: "ana@pedsar.test", estado: true, canal_notificacion: "AMBOS" },
              },
            ],
          },
          {
            data: [
              {
                id: UUID.inscripcion,
                estudiante_id: UUID.estudiante,
                estudiante: { nombres: "Ana", correo: "ana@pedsar.test", estado: true, canal_notificacion: "CORREO" },
                intentos_evaluacion: [],
              },
            ],
          },
        ],
        "recordatorios_enviados.insert": [{}, {}],
      },
    );

    await expect(enviarRecordatoriosPendientes(ahora)).resolves.toEqual({ sesiones: 1, evaluaciones: 1 });
    // HU-16 · las sesiones asíncronas no llevan recordatorio de inicio.
    expect(entorno.admin.de("sesiones", "select")[0].filtros).toContainEqual(["neq", "modalidad", "ASINCRONA"]);
    expect(entorno.admin.de("recordatorios_enviados", "insert")).toHaveLength(2);
    // Sesión (AMBOS) genera notificación in-app y correo; Evaluación (CORREO) solo correo.
    expect(entorno.admin.de("notificaciones", "insert")).toHaveLength(1);
    expect(entorno.tareas).toHaveLength(2);
    await ejecutarTareas();
  });
});
