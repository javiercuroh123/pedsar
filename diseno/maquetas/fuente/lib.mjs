// Componentes y layouts HTML del sistema de diseño PEDSAR (espejo de los componentes de Figma).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const DIR_ICONOS = path.join(RAIZ, "node_modules/lucide-react/dist/esm/icons");
const cacheIconos = new Map();

/** Lee el trazo SVG de un ícono de lucide-react (el mismo set que usa la app). */
function trazo(nombre) {
  if (cacheIconos.has(nombre)) return cacheIconos.get(nombre);
  const src = fs.readFileSync(path.join(DIR_ICONOS, `${nombre}.mjs`), "utf8");
  let i = src.indexOf("node: [");
  if (i < 0) {
    const alias = src.match(/from '\.\/(.+?)\.mjs'/);
    if (!alias) throw new Error(`Ícono sin datos: ${nombre}`);
    return trazo(alias[1]);
  }
  i += "node: ".length;
  let nivel = 0, j = i;
  for (; j < src.length; j++) {
    if (src[j] === "[") nivel++;
    else if (src[j] === "]" && --nivel === 0) break;
  }
  const nodos = new Function(`return ${src.slice(i, j + 1)}`)();
  const svg = nodos
    .map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).filter(([k]) => k !== "key").map(([k, v]) => `${k}="${v}"`).join(" ")}/>`)
    .join("");
  cacheIconos.set(nombre, svg);
  return svg;
}

export const ic = (nombre, t = 20, estilo = "") =>
  `<svg class="ic" width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"${estilo ? ` style="${estilo}"` : ""}>${trazo(nombre)}</svg>`;

export const j = (x) => (Array.isArray(x) ? x.filter(Boolean).join("") : x);
const st = (s) => (s ? ` style="${s}"` : "");

// Layout
export const row = (hijos, s = "", cls = "") => `<div class="row ${cls}"${st(s)}>${Array.isArray(hijos) ? j(hijos) : hijos}</div>`;
export const col = (hijos, s = "", cls = "") => `<div class="col ${cls}"${st(s)}>${Array.isArray(hijos) ? j(hijos) : hijos}</div>`;
export const div = (cls, hijos, s = "") => `<div class="${cls}"${st(s)}>${Array.isArray(hijos) ? j(hijos) : hijos ?? ""}</div>`;
export const txt = (t, cls = "t-b", s = "") => `<div class="${cls}"${st(s)}>${t}</div>`;
export const span = (t, cls = "", s = "") => `<span class="${cls}"${st(s)}>${t}</span>`;
export const divisor = () => `<div class="divisor"></div>`;
export const card = (hijos, s = "", cls = "") => `<div class="card ${cls}"${st(s)}>${Array.isArray(hijos) ? j(hijos) : hijos}</div>`;

// Componentes
export const btn = (texto, { tipo = "primario", t = "m", icono, iconoDer, block, s } = {}) =>
  `<a class="btn btn-${tipo} btn-${t}${block ? " btn-block" : ""}"${st(s)}>${icono ? ic(icono, t === "l" ? 20 : t === "m" ? 18 : 16) : ""}${texto}${iconoDer ? ic(iconoDer, t === "l" ? 20 : 16) : ""}</a>`;
export const btnIcono = (icono, { s = false, sinBorde = false, punto = false, color = "" } = {}) =>
  `<div class="btn-icono${s ? " s" : ""}${sinBorde ? " sin-borde" : ""}"${color ? ` style="color:${color}"` : ""}>${ic(icono, s ? 16 : 18)}${punto ? '<span class="punto-notif"></span>' : ""}</div>`;
export const badge = (texto, tono = "neutro", punto = false) => `<span class="badge b-${tono}">${punto ? '<span class="punto"></span>' : ""}${texto}</span>`;
export const avatar = (ini, t = "m", tono = "") => `<div class="avatar av-${t}${tono ? ` av-${tono}` : ""}">${ini}</div>`;
export const barra = (pct, { tono = "", s = false, ancho } = {}) =>
  `<div class="barra${s ? " s" : ""}${tono ? ` ${tono}` : ""}" style="${ancho ? `width:${ancho}px` : "align-self:stretch"}"><span style="width:${pct}%"></span></div>`;
export const chipIc = (icono, { t = 40, color = "", fondo = "" } = {}) =>
  `<div class="chip-ic" style="width:${t}px;height:${t}px;${color ? `color:${color};` : ""}${fondo ? `background:${fondo};` : ""}">${ic(icono, Math.round(t * 0.5))}</div>`;

export const campo = (label, valor, { icono, trail, estado = "", ayuda, ph = false, s = "", area = false, pequeño = false } = {}) =>
  `<div class="campo"${st(s)}>${label ? `<label>${label}</label>` : ""}<div class="control${estado ? ` ${estado}` : ""}${area ? " area" : ""}${pequeño ? " s" : ""}">${icono ? ic(icono, 18) : ""}<span class="${ph ? "ph" : "v"}">${valor}</span>${trail ? ic(trail, 18) : ""}</div>${ayuda ? `<div class="ayuda${estado === "error" ? " error" : ""}">${ayuda}</div>` : ""}</div>`;
export const selector = (label, valor, { s = "", pequeño = false, icono } = {}) => campo(label, valor, { trail: "chevron-down", s, pequeño, icono });
export const check = (texto, on = false) => `<div class="check${on ? " on" : ""}"><span class="caja">${on ? ic("check", 14) : ""}</span>${texto ? `<span>${texto}</span>` : ""}</div>`;
export const radio = (on = false) => `<div class="radio${on ? " on" : ""}"></div>`;
export const sw = (on = false) => `<div class="switch${on ? " on" : ""}"><span></span></div>`;
export const segmento = (opciones, activo) =>
  `<div class="segmento">${opciones.map((o) => (Array.isArray(o) ? `<div class="${o[0] === activo ? "on" : ""}">${ic(o[1], 16)}${o[0]}</div>` : `<div class="${o === activo ? "on" : ""}">${o}</div>`)).join("")}</div>`;
export const tabs = (items, activo) =>
  `<div class="tabs">${items.map((t) => { const [n, c] = Array.isArray(t) ? t : [t]; return `<div class="tab${n === activo ? " on" : ""}">${n}${c != null ? `<span class="n">${c}</span>` : ""}</div>`; }).join("")}</div>`;
export const alerta = (tono, icono, titulo, texto, extra = "") =>
  `<div class="alerta al-${tono}">${ic(icono, 20)}<div class="col grow" style="gap:2px">${titulo ? `<div class="t-sm">${titulo}</div>` : ""}${texto ? `<div class="t-s">${texto}</div>` : ""}</div>${extra}</div>`;
export const migas = (partes) => `<div class="migas">${partes.map((p, i) => (i === partes.length - 1 ? `<b>${p}</b>` : `<span>${p}</span>${ic("chevron-right", 14)}`)).join("")}</div>`;
export const delta = (v, dir = "sube") => `<span class="delta ${dir}">${ic(dir === "baja" ? "trending-down" : "trending-up", 14)}${v}</span>`;
export const kpi = ({ label, valor, icono, d, dir = "sube", nota = "vs. mes anterior", color, fondo }) =>
  `<div class="kpi"><div class="row between"><span class="t-sm c-sec">${label}</span>${chipIc(icono, { t: 36, color, fondo })}</div><div class="t-h2">${valor}</div>${d ? `<div class="row" style="gap:8px">${delta(d, dir)}<span class="t-c c-ter">${nota}</span></div>` : nota ? `<div class="t-c c-ter">${nota}</div>` : ""}</div>`;
export const fechaBloque = (dia, mes) => `<div class="fecha-bloque"><span>${mes}</span><b>${dia}</b></div>`;
export const paginacion = (texto = "Mostrando 1–10 de 48") =>
  row([txt(texto, "t-s c-ter"), row([btn("Anterior", { tipo: "contorno", t: "s", icono: "chevron-left" }), ...["1", "2", "3", "…", "5"].map((n, i) => `<div class="btn btn-s ${i === 0 ? "btn-secundario" : "btn-fantasma"}" style="width:32px;padding:0">${n}</div>`), btn("Siguiente", { tipo: "contorno", t: "s", iconoDer: "chevron-right" })], "gap:6px")], "padding:14px 20px;border-top:1px solid var(--borde-default)", "between");

/** Tabla con columnas de ancho fijo o flexible: cols = [[titulo, ancho|"grow"]]. */
export const tabla = (cols, filas, { pie = "", sel = [] } = {}) => {
  const celda = (c, i) => `<div class="td${cols[i][1] === "grow" ? " grow" : " nosh"}" style="${cols[i][1] === "grow" ? "" : `width:${cols[i][1]}px;`}${cols[i][2] ? `text-align:${cols[i][2]};display:flex;justify-content:${cols[i][2] === "right" ? "flex-end" : "center"}` : ""}">${c}</div>`;
  return `<div class="tabla"><div class="tr th">${cols.map((c, i) => celda(c[0], i)).join("")}</div>${filas.map((f, k) => `<div class="tr${sel.includes(k) ? " sel" : ""}">${f.map(celda).join("")}</div>`).join("")}${pie}</div>`;
};
export const persona = (ini, nombre, sub, tono = "") => row([avatar(ini, "m", tono), col([txt(nombre, "t-sm"), sub ? txt(sub, "t-c c-ter") : ""])], "gap:12px");

export const logo = (oscuro = false) =>
  `<div class="logo${oscuro ? " osc" : ""}"><div class="iso">${ic("graduation-cap", 20)}</div><div class="col"><span class="nom">PEDSAR</span><span class="lema">Cursos y capacitaciones</span></div></div>`;

export const portadaCurso = (icono, { w = 72, h = 72, r = 12, t = 28, fondo } = {}) =>
  `<div class="portada" style="width:${w}px;height:${h}px;border-radius:${r}px;${fondo ? `background:${fondo}` : ""}">${ic(icono, t)}</div>`;

// Datos compartidos
export const CURSOS = {
  react: { t: "Desarrollo web con React y Next.js", cat: "Desarrollo web", ic: "globe", mod: "Semipresencial", niv: "Intermedio", h: 48, precio: 320, fondo: "linear-gradient(135deg,#0E7490,#18181B)" },
  python: { t: "Python desde cero", cat: "Programación", ic: "book-open", mod: "Virtual", niv: "Básico", h: 40, precio: 180, fondo: "linear-gradient(135deg,#0891B2,#164E63)" },
  excel: { t: "Excel empresarial y Power BI", cat: "Datos y ofimática", ic: "chart-column", mod: "Presencial", niv: "Intermedio", h: 24, precio: 150, fondo: "linear-gradient(135deg,#15803D,#18181B)" },
  redes: { t: "Redes y cableado estructurado", cat: "Redes", ic: "signal", mod: "Presencial", niv: "Básico", h: 32, precio: 220, fondo: "linear-gradient(135deg,#3F3F46,#09090B)" },
  ciber: { t: "Ciberseguridad para pymes", cat: "Ciberseguridad", ic: "shield-check", mod: "Virtual", niv: "Intermedio", h: 30, precio: 260, fondo: "linear-gradient(135deg,#BE123C,#18181B)" },
  sql: { t: "Bases de datos con PostgreSQL", cat: "Datos y ofimática", ic: "database", mod: "Virtual", niv: "Intermedio", h: 36, precio: 200, fondo: "linear-gradient(135deg,#155E75,#09090B)" },
  ia: { t: "Inteligencia artificial aplicada a negocios", cat: "Inteligencia artificial", ic: "sparkles", mod: "Virtual", niv: "Avanzado", h: 40, precio: 350, fondo: "linear-gradient(135deg,#6D28D9,#18181B)" },
  soporte: { t: "Soporte técnico y mantenimiento de PC", cat: "Soporte técnico", ic: "monitor", mod: "Presencial", niv: "Básico", h: 20, precio: 120, fondo: "linear-gradient(135deg,#B45309,#18181B)" },
};
export const tonoModalidad = { Virtual: "cian", Presencial: "neutro", Semipresencial: "violeta" };

// Layouts de página
export const cabeceraPublica = (activo) =>
  `<header class="hdr">${logo()}<nav>${["Inicio", "Cursos", "Nosotros", "Contacto", "Verificar certificado"].map((n) => `<a class="${n === activo ? "on" : ""}">${n}</a>`).join("")}</nav><div class="grow"></div>${row([btnIcono("moon"), btn("Iniciar sesión", { tipo: "fantasma" }), btn("Crear cuenta")], "gap:8px")}</header>`;

export const pie = () => {
  const colPie = (t, items) => col([txt(t, "t-o", "color:var(--grafito-500)"), ...items.map((i) => txt(i, "t-s"))], "gap:12px;width:200px");
  const contacto = (i, t) => row([span(ic(i, 16), "", "color:var(--cian-400)"), txt(t, "t-s")], "gap:10px");
  return `<footer class="ftr">${row([col([logo(true), txt("Cursos y capacitaciones en tecnología y programación. Inscríbete en línea, aprende a tu ritmo y certifícate.", "t-s", "color:var(--grafito-400);width:340px")], "gap:16px;width:360px"), div("grow", ""), colPie("Plataforma", ["Catálogo de cursos", "Verificar certificado", "Iniciar sesión", "Crear cuenta"]), colPie("Empresa", ["Nosotros", "Contacto", "Privacidad y términos", "Libro de reclamaciones"]), col([txt("Contacto", "t-o", "color:var(--grafito-500)"), contacto("map-pin", "Jr. Manuel Medina Paredes 524, Ica"), contacto("phone", "+51 956 000 000"), contacto("mail", "informes@pedsar.pe")], "gap:12px;width:260px")], "gap:64px", "top")}<div class="divisor" style="background:var(--grafito-800)"></div>${row([txt("© 2026 PEDSAR E.I.R.L. · RUC 20605615521", "t-c", "color:var(--grafito-500)"), txt("Hecho en Ica, Perú", "t-c", "color:var(--grafito-500)")], "", "between")}</footer>`;
};

const NAV = {
  estudiante: { chip: "Portal del estudiante", u: ["MQ", "María Quispe", "maria.q@correo.com"], g: [["Aprendizaje", [["Inicio", "layout-dashboard"], ["Mis cursos", "book-open"], ["Evaluaciones", "clipboard-check"], ["Certificados", "award"], ["Pagos y comprobantes", "receipt"]]]] },
  instructor: { chip: "Portal del instructor", u: ["LR", "Luis Ramos", "luis.ramos@pedsar.pe"], g: [["Docencia", [["Inicio", "layout-dashboard"], ["Contenidos", "folder-open"], ["Sesiones y horarios", "calendar-days"], ["Asistencia", "user-check"], ["Evaluaciones", "clipboard-check"], ["Estudiantes y notas", "graduation-cap"]]]] },
  administrador: { chip: "Panel de administración", u: ["AT", "Ana Torres", "admin@pedsar.pe"], g: [["General", [["Panel", "layout-dashboard"], ["Reportes", "chart-column"]]], ["Académico", [["Cursos", "book-open"], ["Categorías", "tags"], ["Certificados", "award"]]], ["Comercial", [["Inscripciones y pagos", "credit-card", "5"], ["Cupones", "ticket-percent"]]], ["Sistema", [["Usuarios y roles", "users"], ["Auditoría", "scroll-text"]]]] },
};
const ROL_TXT = { estudiante: "Estudiante", instructor: "Instructor", administrador: "Administradora" };

export const sidebar = (rol, activo) => {
  const d = NAV[rol];
  const grupos = [...d.g, ["Cuenta", [["Notificaciones", "bell", "3"], ["Mi perfil", "user-round"]]]];
  return `<aside class="sidebar"><div style="padding:4px 8px">${logo(true)}</div><div class="rol-chip"><i></i>${d.chip}</div><nav class="col" style="gap:20px">${grupos
    .map(([t, items]) => `<div class="col" style="gap:2px"><div class="nav-titulo">${t}</div>${items.map(([n, i, c]) => `<div class="nav-item${n === activo ? " on" : ""}">${ic(i, 18)}<span>${n}</span>${c ? `<span class="cont">${c}</span>` : ""}</div>`).join("")}</div>`)
    .join("")}</nav><div class="grow"></div><div class="usuario-card">${avatar(d.u[0])}<div class="col grow"><span class="t-sm" style="color:#fff">${d.u[1]}</span><span class="t-c" style="color:var(--grafito-400)">${d.u[2]}</span></div><span style="color:var(--grafito-400)">${ic("log-out", 18)}</span></div></aside>`;
};

export const topbar = (rol, busqueda = "Buscar cursos, estudiantes, pagos…") => {
  const d = NAV[rol];
  return `<div class="topbar"><div class="buscador">${ic("search", 18)}<span class="grow">${busqueda}</span><span class="kbd">Ctrl K</span></div><div class="grow"></div>${btnIcono("accessibility")}${btnIcono("moon")}${btnIcono("bell", { punto: true })}<div style="width:1px;height:28px;background:var(--borde-default);margin:0 4px"></div>${row([avatar(d.u[0]), col([txt(d.u[1], "t-sm"), txt(ROL_TXT[rol], "t-c c-ter")]), span(ic("chevron-down", 16), "c-ter")], "gap:10px")}</div>`;
};

/** Cabecera de página dentro de un portal: migas, título, descripción y acciones. */
export const cabeceraPortal = (m, titulo, descripcion, acciones = "") =>
  row([col([migas(m), txt(titulo, "t-h2", "margin-top:6px"), descripcion ? txt(descripcion, "t-b c-sec") : ""], "gap:2px", "grow"), acciones ? row(acciones, "gap:8px") : ""], "gap:24px", "base");

export const portal = (rol, activo, contenido) =>
  `<div class="portal">${sidebar(rol, activo)}<div class="main">${topbar(rol)}<main class="contenido">${Array.isArray(contenido) ? j(contenido) : contenido}</main></div></div>`;

export const documento = (titulo, cuerpo, { movil = false, css = "../pedsar.css" } = {}) => `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=${movil ? 390 : 1440}">
<title>${titulo} · PEDSAR</title>
<link rel="stylesheet" href="${css}">
</head>
<body>
<div class="screen${movil ? " movil" : ""}" data-pantalla="${titulo}">
${cuerpo}
</div>
</body>
</html>
`;
