// Cuenta (compartida por los tres roles; se muestra con el menú del estudiante).
import { alerta, avatar, badge, btn, cabeceraPortal, campo, card, chipIc, col, div, ic, portal, row, segmento, selector, span, sw, tabs, txt } from "./lib.mjs";

const perfil = () => {
  const secciones = [["Datos personales", "user-round"], ["Seguridad", "lock"], ["Preferencias", "sliders-horizontal"], ["Privacidad y datos", "shield-check"]];
  return portal("estudiante", "Mi perfil", [
    cabeceraPortal(["Cuenta", "Mi perfil"], "Mi perfil", "Datos personales, seguridad y privacidad de tu cuenta."),
    row([
      col(secciones.map(([t, i], k) => row([span(ic(i, 18), k === 0 ? "c-cian" : "c-ter"), txt(t, "t-sm", k === 0 ? "color:var(--cian-800)" : "color:var(--texto-secundario)")], `gap:10px;height:40px;padding:0 12px;border-radius:8px;${k === 0 ? "background:var(--fondo-marca-suave)" : ""}`)), "gap:4px;width:240px;position:sticky;top:0", "nosh"),
      col([
        card([
          col([txt("Datos personales", "t-h4"), txt("Se usan en tus certificados y comprobantes.", "t-s c-sec")], "gap:2px"),
          row([avatar("MQ", "xl"), col([row([btn("Cambiar foto", { tipo: "contorno", t: "s", icono: "upload" }), btn("Quitar", { tipo: "fantasma", t: "s" })], "gap:8px"), txt("JPG o PNG, máximo 2 MB.", "t-c c-ter")], "gap:8px")], "gap:20px"),
          row([campo("Nombres", "María Fernanda", { s: "flex:1" }), campo("Apellidos", "Quispe Huamán", { s: "flex:1" })], "gap:16px"),
          row([campo("DNI", "47851236", { estado: "inactivo", ayuda: "Para cambiarlo, contacta a soporte.", s: "flex:1" }), campo("Celular", "956 123 456", { icono: "smartphone", s: "flex:1" })], "gap:16px", "top"),
          row([div("", [campo("Correo electrónico", "maria.q@correo.com", { icono: "mail", estado: "inactivo" }), div("", badge("Verificado", "exito", true), "position:absolute;right:12px;top:36px")], "flex:1;position:relative"), selector("Ciudad", "Ica", { s: "flex:1" })], "gap:16px"),
          row([btn("Descartar", { tipo: "fantasma" }), btn("Guardar cambios", { icono: "check" })], "gap:8px;padding-top:8px;border-top:1px solid var(--borde-default)", "jfin"),
        ], "gap:20px"),
        card([
          col([txt("Seguridad", "t-h4"), txt("Cambia tu contraseña periódicamente.", "t-s c-sec")], "gap:2px"),
          campo("Contraseña actual", "••••••••••", { icono: "lock", trail: "eye", s: "width:360px" }),
          row([campo("Nueva contraseña", "••••••••••••", { icono: "lock", trail: "eye", s: "flex:1" }), campo("Confirmar nueva contraseña", "••••••••••••", { icono: "lock", s: "flex:1" })], "gap:16px"),
          txt("Mínimo 8 caracteres, con una mayúscula y un número.", "t-c c-ter"),
          row([btn("Cambiar contraseña", { tipo: "secundario" })], "", "jfin"),
        ], "gap:16px"),
        card([
          col([txt("Preferencias", "t-h4"), txt("Se guardan en este dispositivo.", "t-s c-sec")], "gap:2px"),
          row([col([txt("Tema", "t-sm"), txt("Claro, oscuro o según tu sistema", "t-c c-ter")], "", "grow"), segmento([["Claro", "sun"], ["Oscuro", "moon"], ["Sistema", "monitor"]], "Claro")], "gap:16px"),
          div("divisor", ""),
          row([col([txt("Tamaño de letra", "t-sm"), txt("Amplía el texto de toda la interfaz", "t-c c-ter")], "", "grow"), `<div class="segmento"><div class="on" style="font-size:13px">A</div><div style="font-size:15px">A</div><div style="font-size:18px">A</div></div>`], "gap:16px"),
          div("divisor", ""),
          row([col([txt("Alto contraste", "t-sm"), txt("Refuerza bordes y colores del texto", "t-c c-ter")], "", "grow"), sw(false)], "gap:16px"),
        ], "gap:16px"),
        card([
          col([txt("Privacidad y datos", "t-h4"), txt("Tus derechos según la Ley N.º 29733.", "t-s c-sec")], "gap:2px"),
          row([chipIc("download"), col([txt("Exportar mis datos", "t-sm"), txt("Descarga una copia de tus datos personales, inscripciones y pagos (Ley N.º 29733).", "t-s c-sec")], "gap:2px", "grow"), btn("Exportar mis datos", { tipo: "contorno", icono: "download" })], "gap:16px"),
          div("", row([chipIc("trash", { color: "var(--rojo-700)", fondo: "var(--rojo-100)" }), col([txt("Solicitud de eliminación de cuenta", "t-sm c-peligro"), txt("Eliminaremos tus datos en un plazo de 10 días hábiles. Tus certificados emitidos seguirán siendo verificables.", "t-s c-sec")], "gap:2px", "grow"), btn("Solicitar eliminación", { tipo: "peligro-suave" })], "gap:16px"), "padding:16px;border-radius:12px;border:1px solid var(--rojo-100);background:var(--rojo-50)"),
        ], "gap:16px"),
      ], "gap:24px", "grow"),
    ], "gap:32px", "top"),
  ]);
};

const notificaciones = () => {
  const item = (icono, c, f, titulo, texto, hace, nueva, accion) => row([
    chipIc(icono, { color: `var(${c})`, fondo: `var(${f})` }),
    col([row([txt(titulo, nueva ? "t-sm" : "t-s", "flex:1"), txt(hace, "t-c c-ter")], "gap:12px"), txt(texto, "t-s c-sec"), accion ? row([accion], "margin-top:6px") : ""], "gap:2px", "grow"),
    nueva ? div("", "", "width:8px;height:8px;border-radius:999px;background:var(--marca-acento);margin-top:6px;flex-shrink:0") : div("", "", "width:8px;flex-shrink:0"),
  ], `gap:14px;padding:16px 20px;border-top:1px solid var(--borde-default);${nueva ? "background:rgba(6,182,212,0.04)" : ""}`, "top");
  const grupo = (t) => txt(t, "t-o c-ter", "padding:16px 20px 8px;border-top:1px solid var(--borde-default)");
  const pref = (t, a, b) => row([txt(t, "t-s", "flex:1"), div("", sw(a), "width:56px;display:flex;justify-content:center"), div("", sw(b), "width:56px;display:flex;justify-content:center")], "gap:8px;padding:12px 0;border-top:1px solid var(--borde-default)");
  return portal("estudiante", "Notificaciones", [
    cabeceraPortal(["Cuenta", "Notificaciones"], "Notificaciones", "Avisos por correo e in-app sobre sesiones, evaluaciones y pagos.", [btn("Marcar todas como leídas", { tipo: "contorno", icono: "check-check" })]),
    row([
      card([
        row([tabs([["Todas", 12], ["Sin leer", 3]], "Todas")], "padding:4px 20px 0"),
        txt("Hoy", "t-o c-ter", "padding:16px 20px 8px"),
        item("calendar-days", "--cian-700", "--cian-50", "Tu clase empieza en 1 hora", "React y Next.js · Clase 6: Formularios · 19:00 por Zoom", "hace 5 min", true, `<a class="btn btn-suave btn-s">${ic("video", 16)}Unirse a la clase</a>`),
        item("circle-check", "--verde-700", "--verde-50", "Pago aprobado", "Tu pago de S/ 288.00 con Yape fue aprobado. Boleta B001-000482.", "hace 2 h", true, `<a class="btn btn-fantasma btn-s">${ic("download", 16)}Descargar boleta</a>`),
        item("clipboard-check", "--ambar-700", "--ambar-50", "Nueva evaluación disponible", "Módulo 2: Fundamentos de React · 10 preguntas · vence el 3 de octubre", "hace 4 h", true),
        grupo("Esta semana"),
        item("folder-open", "--violeta-700", "--violeta-50", "Nuevo material publicado", "Luis Ramos subió «Guía de hooks en React.pdf» al módulo 2.", "lun 28 set", false),
        item("message-circle", "--cian-700", "--cian-50", "Mensaje del instructor", "«Recuerden traer su laptop al taller presencial del sábado.»", "dom 27 set", false),
        item("receipt", "--grafito-700", "--grafito-100", "Comprobante disponible", "Tu boleta B001-000311 ya está disponible en Pagos y comprobantes.", "vie 25 set", false),
      ], "", "p0 grow"),
      card([
        col([txt("Preferencias de aviso", "t-h4"), txt("Elige por dónde quieres enterarte.", "t-s c-sec")], "gap:2px"),
        col([row([txt("Tipo", "t-o c-ter", "flex:1"), txt("Correo", "t-o c-ter", "width:56px;text-align:center"), txt("In-app", "t-o c-ter", "width:56px;text-align:center")], "gap:8px;padding-bottom:4px"), pref("Recordatorios de sesiones", true, true), pref("Evaluaciones", true, true), pref("Pagos y comprobantes", true, true), pref("Materiales nuevos", false, true), pref("Novedades y promociones", false, false)]),
        alerta("info", "info", "", "Los avisos de seguridad de tu cuenta siempre se envían por correo."),
      ], "width:360px;gap:16px", "nosh"),
    ], "gap:24px", "top"),
  ]);
};

const pantallas = [
  { grupo: "Cuenta", archivo: "cuenta-perfil", titulo: "Cuenta · Mi perfil", render: perfil },
  { grupo: "Cuenta", archivo: "cuenta-notificaciones", titulo: "Cuenta · Notificaciones", render: notificaciones },
];

export default pantallas;
