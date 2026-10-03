// Pantallas móviles (390 × 844) de los flujos clave.
import { alerta, avatar, badge, barra, btn, btnIcono, campo, card, check, chipIc, col, CURSOS, div, ic, logo, row, span, tonoModalidad, txt } from "./lib.mjs";

const estado = (oscuro = false) => row([txt("9:41", "t-sm", `font-weight:600;${oscuro ? "color:#fff" : ""}`), row([ic("signal", 16), ic("wifi", 16), ic("battery-full", 20)], `gap:6px;${oscuro ? "color:#fff" : ""}`)], "", "m-status between");
const cabecera = (izq, der) => `<div class="m-hdr">${izq}${der}</div>`;
const atras = (t, sub) => row([btnIcono("arrow-left", { sinBorde: true }), col([txt(t, "t-sm"), sub ? txt(sub, "t-c c-ter") : ""], "")], "gap:4px");
const tabbar = (activo) => `<div class="m-tabbar">${[["Inicio", "house"], ["Cursos", "book-open"], ["Evaluar", "clipboard-check"], ["Logros", "award"], ["Perfil", "user-round"]].map(([t, i]) => `<div class="${t === activo ? "on" : ""}">${ic(i, 22)}${t}</div>`).join("")}</div>`;
const cursoCompacto = (c, extra = "") => row([div("portada", ic(c.ic, 30), `width:96px;height:96px;border-radius:12px;background:${c.fondo}`), col([txt(c.cat, "t-o c-cian", "font-size:11px"), txt(c.t, "t-sm"), row([badge(c.mod, tonoModalidad[c.mod]), txt(`${c.h} h`, "t-c c-ter")], "gap:6px"), row([txt(`S/ ${c.precio}`, "t-bm"), extra], "", "between")], "gap:4px", "grow")], "gap:12px;padding:12px;border-radius:14px;background:#fff;border:1px solid var(--borde-default)");

const inicio = () => [
  estado(), cabecera(logo(), btnIcono("menu", { sinBorde: true })),
  col([
    row([badge("Nuevo", "cian"), txt("Inscripciones abiertas · Octubre", "t-c c-cian")], "gap:8px;padding:4px 10px 4px 4px;border-radius:999px;background:var(--fondo-marca-suave);align-self:flex-start"),
    txt("Aprende tecnología con certificación verificable", "t-h2"),
    txt("Inscríbete en línea las 24 horas, paga con Yape, Plin o tarjeta y recibe tu certificado digital.", "t-b c-sec"),
    campo("", "¿Qué quieres aprender?", { icono: "search", ph: true }),
    btn("Ver cursos disponibles", { t: "l", block: true, iconoDer: "arrow-right" }),
  ], "padding:24px 16px;gap:16px;background:#fff"),
  row([["clock", "Inscripción 24/7"], ["wallet", "Yape y Plin"], ["badge-check", "Certificado QR"]].map(([i, t]) => col([chipIc(i, { t: 36 }), txt(t, "t-c centro-t")], "gap:8px;flex:1", "acentro")), "padding:20px 16px;gap:8px"),
  col([row([txt("Próximos cursos", "t-h4"), txt("Ver todos", "t-sm c-enl")], "", "between"), cursoCompacto(CURSOS.python, txt("12 cupos", "t-c c-ter")), cursoCompacto(CURSOS.react, txt("8 cupos", "t-c c-adv")), cursoCompacto(CURSOS.excel, txt("5 cupos", "t-c c-peligro"))], "padding:8px 16px 24px;gap:12px"),
];

const catalogo = () => [
  estado(), cabecera(logo(), btnIcono("menu", { sinBorde: true })),
  col([txt("Catálogo de cursos", "t-h3"), campo("", "Programación", { icono: "search" }), row([btn("Filtros · 3", { tipo: "contorno", t: "s", icono: "sliders-horizontal" }), btn("Más recientes", { tipo: "contorno", t: "s", iconoDer: "chevron-down" })], "gap:8px"), row(["Programación", "Virtual", "Intermedio"].map((t) => row([txt(t, "t-sm", "color:var(--cian-800)"), span(ic("x", 14), "c-cian")], "gap:6px;padding:6px 10px;border-radius:999px;background:var(--fondo-marca-suave);border:1px solid var(--cian-200)")), "gap:8px")], "padding:16px;gap:12px;background:#fff;border-bottom:1px solid var(--borde-default)"),
  col([txt("6 cursos encontrados", "t-sm c-sec"), cursoCompacto(CURSOS.python, btnIcono("chevron-right", { s: true, sinBorde: true })), cursoCompacto(CURSOS.react, btnIcono("chevron-right", { s: true, sinBorde: true })), cursoCompacto(CURSOS.sql, btnIcono("chevron-right", { s: true, sinBorde: true })), cursoCompacto(CURSOS.ia, btnIcono("chevron-right", { s: true, sinBorde: true }))], "padding:16px;gap:12px"),
];

const detalle = () => [
  div("", [estado(true), row([div("", ic("arrow-left", 20), "width:40px;height:40px;border-radius:999px;background:rgba(255,255,255,0.16);color:#fff;display:flex;align-items:center;justify-content:center"), div("", ic("share-2", 18), "width:40px;height:40px;border-radius:999px;background:rgba(255,255,255,0.16);color:#fff;display:flex;align-items:center;justify-content:center")], "padding:4px 16px", "between"), div("", ic("globe", 64), "flex:1;display:flex;align-items:center;justify-content:center;color:var(--cian-200)")], "height:250px;display:flex;flex-direction:column;background:linear-gradient(135deg,#0E7490,#09090B)"),
  col([
    row([badge("Destacado", "rosa"), badge("Intermedio", "cian"), badge("Semipresencial", "violeta")], "gap:6px", "wrap"),
    txt(CURSOS.react.t, "t-h3"),
    row([span(ic("star", 16, "fill:var(--ambar-500)"), "", "color:var(--ambar-500)"), txt("4.9 · 86 reseñas · 17 inscritos", "t-s c-sec")], "gap:6px"),
    row([["clock", "48 horas"], ["calendar", "Inicia 12 oct"], ["map-pin", "Ica + Zoom"], ["users", "8 cupos"]].map(([i, t]) => row([span(ic(i, 16), "c-cian"), txt(t, "t-s")], "gap:8px;width:calc(50% - 6px);padding:10px 12px;border-radius:10px;background:#fff;border:1px solid var(--borde-default)")), "gap:12px", "wrap"),
    card([txt("Lo que aprenderás", "t-h4"), ...["Componentes reutilizables con React", "Rutas y datos con Next.js", "Estilos con TailwindCSS", "Despliegue en Vercel"].map((t) => row([span(ic("check", 18), "c-exito"), txt(t, "t-s")], "gap:10px"))], "gap:10px;padding:16px"),
    card([row([txt("Temario", "t-h4"), txt("3 módulos · 18 clases", "t-c c-ter")], "", "between"), ...[["1", "Introducción y entorno"], ["2", "Fundamentos y práctica"], ["3", "Proyecto final"]].map(([n, t]) => row([div("", txt(n, "t-sm", "color:var(--cian-800)"), "width:28px;height:28px;border-radius:8px;background:var(--fondo-marca-suave);display:flex;align-items:center;justify-content:center"), txt(t, "t-sm", "flex:1"), span(ic("chevron-down", 18), "c-ter")], "gap:12px;padding:8px 0;border-top:1px solid var(--borde-default)"))], "gap:6px;padding:16px"),
  ], "padding:20px 16px;gap:16px"),
  `<div class="m-cta">${col([row([txt("S/ 320", "t-h3"), txt("S/ 380", "t-s c-ter tachado")], "gap:8px", "base"), txt("Quedan 8 cupos", "t-c c-adv")], "")}${btn("Inscribirme", { t: "l", s: "flex:1", iconoDer: "arrow-right" })}</div>`,
];

const pagoYape = () => [
  estado(), cabecera(atras("Inscripción", "Paso 2 de 3 · Pago"), row([span(ic("lock", 14), "c-exito"), txt("Seguro", "t-c c-exito")], "gap:4px")),
  row([1, 2, 3].map((i) => div("grow", "", `height:4px;border-radius:999px;background:var(${i <= 2 ? "--accion-primaria" : "--grafito-200"})`)), "gap:6px;padding:12px 16px 0"),
  col([
    row([div("portada", ic("globe", 22), "width:48px;height:48px;border-radius:10px;background:linear-gradient(135deg,#0E7490,#18181B)"), col([txt(CURSOS.react.t, "t-sm"), txt("BIENVENIDA10 aplicado · −10%", "t-c c-exito")], "gap:2px", "grow"), txt("S/ 288", "t-bm")], "gap:12px;padding:12px;border-radius:12px;background:#fff;border:1px solid var(--borde-default)"),
    txt("Método de pago", "t-h4"),
    row([["Tarjeta", "credit-card", "#0E7490", false], ["Yape", "smartphone", "#742284", true], ["Plin", "smartphone", "#00A7B8", false]].map(([t, i, c, on]) => col([div("", ic(i, 16), `width:32px;height:32px;border-radius:8px;background:${c};color:#fff;display:flex;align-items:center;justify-content:center`), txt(t, "t-sm")], `gap:8px;flex:1;padding:12px;border-radius:12px;background:${on ? "var(--fondo-marca-suave)" : "#fff"};border:${on ? "2px solid var(--accion-primaria)" : "1px solid var(--borde-default)"}`, "acentro")), "gap:8px"),
    col([
      row([div("", ic("qr-code", 96), "width:120px;height:120px;border-radius:10px;background:#fff;display:flex;align-items:center;justify-content:center;border:1px solid var(--borde-default)"), col(["Abre Yape y toca «Yapear»", "Escanea el QR o yapea al 956 000 000", "Monto exacto: S/ 288.00"].map((t, k) => row([div("", txt(String(k + 1), "t-c", "color:var(--violeta-700)"), "width:22px;height:22px;border-radius:999px;background:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0"), txt(t, "t-s")], "gap:8px", "top")), "gap:10px", "grow")], "gap:14px", "top"),
      campo("Código de aprobación", "123456", { estado: "foco", ayuda: "6 dígitos · generado en Yape" }),
    ], "gap:16px;padding:16px;border-radius:14px;background:var(--violeta-50);border:1px solid var(--violeta-100)"),
    check("Acepto los términos y la política de privacidad.", true),
  ], "padding:16px;gap:14px"),
  `<div class="m-cta">${btn("Confirmar pago · S/ 288.00", { t: "l", block: true, icono: "lock" })}</div>`,
];

const portalInicio = () => [
  estado(),
  row([row([avatar("MQ", "m"), col([txt("Hola, María", "t-bm"), txt("Portal del estudiante", "t-c c-ter")], "")], "gap:10px"), btnIcono("bell", { punto: true })], "padding:8px 16px 12px;background:#fff;border-bottom:1px solid var(--borde-default)", "between"),
  col([
    div("", [row([badge("Módulo 2", "cian"), txt("68%", "t-sm", "color:#fff")], "", "between"), txt(CURSOS.react.t, "t-h4", "color:#fff"), txt("Clase 5 · Hooks: useState y useEffect", "t-s", "color:var(--grafito-300)"), div("barra", '<span style="width:68%;background:var(--cian-400)"></span>', "align-self:stretch;background:rgba(255,255,255,0.2)"), btn("Continuar clase", { t: "m", icono: "circle-play", block: true, s: "background:#fff;color:var(--cian-800)" })], "padding:16px;border-radius:16px;background:linear-gradient(135deg,#0E7490,#18181B);display:flex;flex-direction:column;gap:10px"),
    row([["2", "Cursos activos", "book-open"], ["92%", "Asistencia", "user-check"]].map(([v, l, i]) => col([chipIc(i, { t: 32 }), txt(v, "t-h3"), txt(l, "t-c c-ter")], "gap:6px;flex:1;padding:14px;border-radius:14px;background:#fff;border:1px solid var(--borde-default)")), "gap:12px"),
    row([chipIc("clipboard-check", { color: "var(--ambar-700)", fondo: "var(--ambar-50)" }), col([txt("Evaluación pendiente", "t-sm"), txt("Módulo 2 · vence en 4 días", "t-c c-ter")], "gap:2px", "grow"), btn("Rendir", { t: "s" })], "gap:12px;padding:14px;border-radius:14px;background:#fff;border:1px solid var(--ambar-100)"),
    col([txt("Próximas sesiones", "t-h4"), ...[["01", "Oct", "React · Formularios", "Jue 19:00 · Virtual", true], ["03", "Oct", "Excel · Tablas dinámicas", "Sáb 09:00 · Presencial", false]].map(([d, m, t, s, v]) => row([`<div class="fecha-bloque"><span>${m}</span><b>${d}</b></div>`, col([txt(t, "t-sm"), txt(s, "t-c c-ter")], "gap:2px", "grow"), v ? btn("Unirse", { tipo: "suave", t: "s" }) : ""], "gap:12px;padding:12px;border-radius:14px;background:#fff;border:1px solid var(--borde-default)"))], "gap:10px"),
  ], "padding:16px;gap:14px"),
  tabbar("Inicio"),
];

const aula = () => [
  estado(), cabecera(atras("Aula virtual", "React y Next.js"), btnIcono("list", { sinBorde: true })),
  div("", [div("", ic("circle-play", 32), "width:64px;height:64px;border-radius:999px;background:rgba(255,255,255,0.14);color:#fff;display:flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,0.3)"), div("", div("", "", "width:28%;height:100%;background:var(--cian-400)"), "position:absolute;left:0;right:0;bottom:0;height:3px;background:rgba(255,255,255,0.25)")], "height:220px;background:radial-gradient(circle at 30% 30%,#155E75,#09090B 70%);display:flex;align-items:center;justify-content:center;position:relative"),
  col([
    col([badge("Módulo 2 · Clase 5", "cian"), txt("Hooks: useState y useEffect", "t-h3"), txt("60 min · Luis Ramos", "t-s c-ter")], "gap:6px"),
    row([barra(68, { s: true, ancho: 250 }), txt("12 de 18 clases", "t-c c-ter")], "gap:10px"),
    `<div class="tabs"><div class="tab">Descripción</div><div class="tab on">Materiales <span class="n">3</span></div><div class="tab">Anuncios</div></div>`,
    ...[["file-text", "Guía de hooks en React.pdf", "PDF · 2.4 MB", "--rojo-600", "--rojo-50", "download"], ["link", "Documentación de React", "Enlace externo", "--cian-700", "--cian-50", "external-link"], ["video", "Grabación de la clase", "Video · 1 h 52 min", "--violeta-600", "--violeta-50", "circle-play"]].map(([i, t, s, c, f, a]) => row([chipIc(i, { t: 36, color: `var(${c})`, fondo: `var(${f})` }), col([txt(t, "t-sm"), txt(s, "t-c c-ter")], "gap:2px", "grow"), btnIcono(a, { s: true })], "gap:12px;padding:10px 0;border-bottom:1px solid var(--borde-default)")),
  ], "padding:16px;gap:14px"),
  `<div class="m-cta">${btn("Anterior", { tipo: "contorno", t: "l", icono: "arrow-left" })}${btn("Siguiente clase", { t: "l", s: "flex:1", iconoDer: "arrow-right" })}</div>`,
];

const verificar = () => [
  estado(), cabecera(logo(), btnIcono("menu", { sinBorde: true })),
  col([
    col([chipIc("shield-check", { t: 48 }), txt("Verificar certificado", "t-h2 centro-t"), txt("Ingresa el código o escanea el QR del certificado.", "t-s c-sec centro-t")], "gap:10px", "acentro"),
    campo("", "PED-2026-7Q4K9X2M", { icono: "qr-code" }),
    btn("Verificar", { t: "l", block: true, icono: "search" }),
  ], "padding:24px 16px;gap:14px;background:#fff;border-bottom:1px solid var(--borde-default)"),
  col([
    alerta("exito", "badge-check", "Certificado válido", "Emitido por PEDSAR E.I.R.L. y vigente."),
    card([...[["Titular", "María F. Quispe Huamán"], ["Curso", "Python desde cero"], ["Duración", "40 horas"], ["Nota final", "18 / 20"], ["Emisión", "15/08/2026"]].map(([a, b]) => row([txt(a, "t-s c-sec"), txt(b, "t-sm")], "padding:6px 0;border-bottom:1px solid var(--borde-default)", "between")), btn("Descargar PDF", { tipo: "contorno", block: true, icono: "download" })], "gap:6px;padding:16px"),
  ], "padding:16px;gap:12px"),
];

const login = () => [
  estado(),
  col([
    div("", logo(), "align-self:center;margin-bottom:12px"),
    col([txt("Iniciar sesión", "t-h2 centro-t"), txt("Ingresa a tu aula virtual.", "t-b c-sec centro-t")], "gap:6px"),
    campo("Correo electrónico", "maria.q@correo.com", { icono: "mail" }),
    campo("Contraseña", "••••••••••", { icono: "lock", trail: "eye" }),
    row([check("Recordarme", true), txt("¿La olvidaste?", "t-sm c-enl")], "", "between"),
    btn("Iniciar sesión", { t: "l", block: true }),
    row([div("grow", "", "height:1px;background:var(--borde-default)"), txt("o", "t-c c-ter"), div("grow", "", "height:1px;background:var(--borde-default)")], "gap:12px"),
    btn("Continuar con Google", { tipo: "contorno", t: "l", block: true, icono: "globe" }),
    row([txt("¿No tienes cuenta?", "t-s c-sec"), txt("Crear cuenta", "t-sm c-enl")], "gap:6px", "jcentro"),
  ], "padding:32px 20px;gap:18px;flex:1;background:#fff"),
];

const pantallas = [
  { grupo: "Móvil", archivo: "movil-inicio", titulo: "Móvil · Inicio", render: inicio, movil: true },
  { grupo: "Móvil", archivo: "movil-catalogo", titulo: "Móvil · Catálogo", render: catalogo, movil: true },
  { grupo: "Móvil", archivo: "movil-detalle-curso", titulo: "Móvil · Detalle de curso", render: detalle, movil: true },
  { grupo: "Móvil", archivo: "movil-pago-yape", titulo: "Móvil · Pago con Yape", render: pagoYape, movil: true },
  { grupo: "Móvil", archivo: "movil-portal-inicio", titulo: "Móvil · Portal del estudiante", render: portalInicio, movil: true },
  { grupo: "Móvil", archivo: "movil-aula-virtual", titulo: "Móvil · Aula virtual", render: aula, movil: true },
  { grupo: "Móvil", archivo: "movil-verificar", titulo: "Móvil · Verificar certificado", render: verificar, movil: true },
  { grupo: "Móvil", archivo: "movil-login", titulo: "Móvil · Iniciar sesión", render: login, movil: true },
];

export default pantallas;
