// Panel de administración.
import { alerta, avatar, badge, barra, btn, btnIcono, cabeceraPortal, campo, card, check, chipIc, col, CURSOS, div, ic, kpi, paginacion, persona, portadaCurso, portal, row, segmento, selector, span, sw, tabla, tabs, tonoModalidad, txt } from "./lib.mjs";

const AD = (activo, contenido) => portal("administrador", activo, contenido);
const tonos = ["", "rosa", "violeta", "ambar", "verde"];
const metodo = (m) => {
  const M = { Yape: ["Y", "#742284"], Plin: ["P", "#00A7B8"], Culqi: ["", "#0E7490", "credit-card"], Izipay: ["", "#DC2626", "credit-card"], Niubiz: ["", "#18181B", "credit-card"] }[m];
  return row([div("", M[2] ? ic(M[2], 14) : M[0], `width:24px;height:24px;border-radius:6px;background:${M[1]};color:#fff;font-size:12px;font-weight:600;display:flex;align-items:center;justify-content:center`), txt(M[2] ? `Tarjeta · ${m}` : m, "t-s")], "gap:8px");
};

// Gráficos (HTML/SVG plano para que se importen como formas editables)
const barras = (datos, alto = 200) => {
  const max = Math.max(...datos.map((d) => d[1]));
  return row([
    col([...[max, Math.round(max * 0.66), Math.round(max * 0.33), 0].map((v) => txt(String(v), "t-c c-ter"))], `height:${alto}px;justify-content:space-between;width:28px;padding-bottom:22px`),
    row(datos.map(([m, v], i) => col([txt(String(v), "t-c", `color:var(${i === datos.length - 1 ? "--cian-800" : "--texto-terciario"});font-weight:600`), div("", "", `width:100%;height:${Math.round((v / max) * (alto - 48))}px;border-radius:6px 6px 2px 2px;background:var(${i === datos.length - 1 ? "--accion-primaria" : "--cian-200"})`), txt(m, "t-c c-ter")], "gap:6px;flex:1 1 0", "acentro jfin")), `gap:10px;height:${alto}px;flex:1;border-bottom:1px solid var(--borde-default);background:repeating-linear-gradient(180deg,transparent 0 ${Math.round((alto - 22) / 3) - 1}px,var(--grafito-100) ${Math.round((alto - 22) / 3) - 1}px ${Math.round((alto - 22) / 3)}px)`, "base"),
  ], "gap:8px", "base");
};
const dona = (segs, total, etiqueta) => {
  const C = 2 * Math.PI * 70;
  let acc = 0;
  const arcos = segs.map(([, v, c]) => { const l = (v / total) * C; const s = `<circle cx="90" cy="90" r="70" fill="none" stroke="${c}" stroke-width="22" stroke-dasharray="${l - 3} ${C - l + 3}" stroke-dashoffset="${-acc}" transform="rotate(-90 90 90)"/>`; acc += l; return s; }).join("");
  return div("", `<svg width="180" height="180" viewBox="0 0 180 180"><circle cx="90" cy="90" r="70" fill="none" stroke="#F4F4F5" stroke-width="22"/>${arcos}<text x="90" y="88" text-anchor="middle" font-family="Inter" font-size="28" font-weight="600" fill="#18181B">${total}</text><text x="90" y="110" text-anchor="middle" font-family="Inter" font-size="12" font-weight="500" fill="#71717A">${etiqueta}</text></svg>`, "width:180px;height:180px;flex-shrink:0");
};
const linea = (vals, w = 640, h = 220) => {
  const max = Math.max(...vals) * 1.15, paso = w / (vals.length - 1);
  const pts = vals.map((v, i) => [Math.round(i * paso), Math.round(h - (v / max) * h)]);
  const d = pts.map((p) => p.join(",")).join(" ");
  const grid = [0.25, 0.5, 0.75].map((f) => `<line x1="0" x2="${w}" y1="${h * f}" y2="${h * f}" stroke="#F4F4F5"/>`).join("");
  return `<svg width="100%" height="${h + 4}" viewBox="0 -2 ${w} ${h + 4}" preserveAspectRatio="none" style="display:block">${grid}<polygon points="0,${h} ${d} ${w},${h}" fill="rgba(8,145,178,0.12)"/><polyline points="${d}" fill="none" stroke="#0E7490" stroke-width="2.5" stroke-linejoin="round"/>${pts.map(([x, y], i) => (i === pts.length - 1 ? `<circle cx="${x}" cy="${y}" r="5" fill="#fff" stroke="#0E7490" stroke-width="2.5"/>` : "")).join("")}</svg>`;
};
const leyenda = (c, t, v) => row([div("", "", `width:10px;height:10px;border-radius:3px;background:${c}`), txt(t, "t-s", "flex:1"), txt(v, "t-sm")], "gap:10px");

const panel = () => AD("Panel", [
  cabeceraPortal(["Administración", "Panel"], "Panel de administración", "Resumen del negocio al 29 de septiembre de 2026.", [segmento(["7 días", "30 días", "12 meses"], "30 días"), btn("Exportar", { tipo: "contorno", icono: "download" })]),
  row([
    kpi({ label: "Inscripciones del mes", valor: "128", icono: "users", d: "+12%" }),
    kpi({ label: "Ingresos del mes", valor: "S/ 24,860", icono: "wallet", color: "var(--verde-700)", fondo: "var(--verde-50)", d: "+8%" }),
    kpi({ label: "Pagos por verificar", valor: "5", icono: "hourglass", color: "var(--ambar-700)", fondo: "var(--ambar-50)", nota: "El más antiguo hace 18 h" }),
    kpi({ label: "Certificados emitidos", valor: "42", icono: "award", color: "var(--rosa-600)", fondo: "var(--rosa-50)", d: "+15%" }),
  ], "gap:16px", "stretch"),
  row([
    card([row([col([txt("Matrículas por mes", "t-h4"), txt("Inscripciones registradas en los últimos 12 meses", "t-s c-ter")], "gap:2px"), badge("+34% interanual", "exito", true)], "", "between top"), barras([["Oct", 42], ["Nov", 55], ["Dic", 38], ["Ene", 61], ["Feb", 74], ["Mar", 96], ["Abr", 88], ["May", 92], ["Jun", 81], ["Jul", 104], ["Ago", 115], ["Set", 128]], 240)], "gap:20px", "grow"),
    card([col([txt("Oferta por modalidad", "t-h4"), txt("24 cursos publicados", "t-s c-ter")], "gap:2px"), row([dona([["Virtual", 12, "#0891B2"], ["Presencial", 8, "#3F3F46"], ["Semipresencial", 4, "#7C3AED"]], 24, "cursos")], "", "jcentro"), col([leyenda("#0891B2", "Virtual", "12 · 50%"), leyenda("#3F3F46", "Presencial", "8 · 33%"), leyenda("#7C3AED", "Semipresencial", "4 · 17%")], "gap:10px")], "width:340px;gap:16px", "nosh"),
  ], "gap:24px", "stretch"),
  row([
    card([row([row([txt("Pagos por verificar", "t-h4"), badge("5", "adv")], "gap:8px"), txt("Ver todos", "t-sm c-enl")], "padding:20px 20px 12px", "between"),
      tabla([["Estudiante", "grow"], ["Método", 110], ["Monto", 90], ["Hace", 50], ["", 180, "right"]], [
        [persona("NR", "Nicole Rojas", "Ciberseguridad para pymes", "rosa"), metodo("Plin"), txt("S/ 260.00", "t-sm"), txt("18 h", "t-s c-ter"), row([btn("Rechazar", { tipo: "fantasma", t: "s" }), btn("Aprobar", { tipo: "suave", t: "s", icono: "check" })], "gap:6px")],
        [persona("KS", "Kevin Saravia", "React y Next.js", "violeta"), metodo("Yape"), txt("S/ 288.00", "t-sm"), txt("6 h", "t-s c-ter"), row([btn("Rechazar", { tipo: "fantasma", t: "s" }), btn("Aprobar", { tipo: "suave", t: "s", icono: "check" })], "gap:6px")],
        [persona("BF", "Bruno Flores", "Excel y Power BI", "ambar"), metodo("Yape"), txt("S/ 150.00", "t-sm"), txt("2 h", "t-s c-ter"), row([btn("Rechazar", { tipo: "fantasma", t: "s" }), btn("Aprobar", { tipo: "suave", t: "s", icono: "check" })], "gap:6px")],
      ])], "", "p0 grow"),
    card([row([txt("Ocupación por curso", "t-h4"), txt("Cupos", "t-c c-ter")], "", "between"), ...[[CURSOS.excel, 18, 20], [CURSOS.react, 17, 25], [CURSOS.python, 24, 30], [CURSOS.redes, 11, 18], [CURSOS.ciber, 14, 30]].map(([c, a, b]) => { const p = Math.round((a / b) * 100); return col([row([txt(c.t, "t-s", "flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"), txt(`${a}/${b}`, "t-sm")], "gap:10px"), barra(p, { s: true, tono: p >= 90 ? "peligro" : p >= 70 ? "adv" : "" })], "gap:6px"); })], "width:340px;gap:14px", "nosh"),
  ], "gap:24px", "stretch"),
]);

const reportes = () => AD("Reportes", [
  cabeceraPortal(["Administración", "Reportes"], "Reportes", "Inscripciones, ingresos y ocupación por periodo.", [btn("Exportar CSV", { tipo: "contorno", icono: "file-spreadsheet" }), btn("Exportar PDF", { icono: "download" })]),
  card(row([campo("Desde", "01/07/2026", { icono: "calendar", s: "width:180px" }), campo("Hasta", "29/09/2026", { icono: "calendar", s: "width:180px" }), selector("Curso", "Todos los cursos", { s: "flex:1" }), selector("Modalidad", "Todas", { s: "width:200px" }), btn("Aplicar filtros", { tipo: "secundario", icono: "funnel", s: "height:44px" })], "gap:16px", "base"), "padding:20px"),
  row([
    kpi({ label: "Inscripciones", valor: "342", icono: "users", d: "+18%", nota: "vs. trimestre anterior" }),
    kpi({ label: "Confirmadas", valor: "318", icono: "circle-check", color: "var(--verde-700)", fondo: "var(--verde-50)", nota: "93% del total" }),
    kpi({ label: "Ingresos aprobados", valor: "S/ 71,420", icono: "wallet", d: "+11%", nota: "vs. trimestre anterior" }),
    kpi({ label: "Ticket promedio", valor: "S/ 224.60", icono: "receipt", color: "var(--violeta-700)", fondo: "var(--violeta-50)", nota: "Con cupones aplicados" }),
  ], "gap:16px", "stretch"),
  row([
    card([row([col([txt("Ingresos por semana", "t-h4"), txt("Julio – septiembre 2026", "t-s c-ter")], "gap:2px"), row([txt("S/ 7,480", "t-h3"), badge("Semana actual", "cian")], "gap:8px")], "", "between top"), linea([3200, 4100, 3900, 5200, 4800, 5600, 6100, 5400, 6900, 6300, 7100, 6800, 7480]), row(["Sem 27", "Sem 29", "Sem 31", "Sem 33", "Sem 35", "Sem 37", "Sem 39"].map((s) => txt(s, "t-c c-ter")), "", "between")], "gap:16px", "grow"),
    card([txt("Ingresos por método de pago", "t-h4"), ...[["Yape", 42, "S/ 29,996", "#742284"], ["Tarjeta · Culqi", 28, "S/ 19,998", "#0E7490"], ["Plin", 18, "S/ 12,856", "#00A7B8"], ["Tarjeta · Izipay", 8, "S/ 5,714", "#DC2626"], ["Tarjeta · Niubiz", 4, "S/ 2,856", "#18181B"]].map(([m, p, v, c]) => col([row([txt(m, "t-sm", "flex:1"), txt(v, "t-s c-sec"), txt(`${p}%`, "t-sm", "width:40px;text-align:right")], "gap:10px"), div("barra", `<span style="width:${p * 2}%;background:${c}"></span>`, "align-self:stretch")], "gap:8px"))], "width:380px;gap:16px", "nosh"),
  ], "gap:24px", "stretch"),
  card([row([txt("Inscripciones por curso", "t-h4"), btn("Ver detalle", { tipo: "fantasma", t: "s", iconoDer: "arrow-right" })], "padding:20px 20px 12px", "between"),
    tabla([["Curso", "grow"], ["Modalidad", 140], ["Inscritos", 100, "center"], ["Ocupación", 220], ["Ingresos", 130, "right"]], [[CURSOS.python, 72, 90, "S/ 11,880"], [CURSOS.react, 61, 75, "S/ 17,568"], [CURSOS.excel, 58, 60, "S/ 7,830"], [CURSOS.ciber, 44, 90, "S/ 10,296"], [CURSOS.ia, 39, 75, "S/ 12,285"]].map(([c, a, b, v]) => { const p = Math.round((a / b) * 100); return [row([portadaCurso(c.ic, { w: 36, h: 36, r: 8, t: 16, fondo: c.fondo }), txt(c.t, "t-sm")], "gap:12px"), badge(c.mod, tonoModalidad[c.mod]), txt(String(a), "t-sm"), row([barra(p, { ancho: 140, tono: p >= 90 ? "peligro" : p >= 70 ? "adv" : "" }), txt(`${p}%`, "t-s")], "gap:10px"), txt(v, "t-sm")]; }))], "", "p0"),
]);

const cursos = () => {
  const est = { Publicado: "exito", Borrador: "neutro", Despublicado: "adv" };
  const filas = [[CURSOS.react, "Luis Ramos", 17, 25, "Publicado", true], [CURSOS.python, "Luis Ramos", 24, 30, "Publicado", true], [CURSOS.excel, "Carla Torres", 18, 20, "Publicado", true], [CURSOS.redes, "Jorge Mendoza", 11, 18, "Publicado", false], [CURSOS.ciber, "Jorge Mendoza", 14, 30, "Publicado", false], [CURSOS.sql, "Luis Ramos", 17, 30, "Publicado", false], [CURSOS.ia, null, 0, 25, "Borrador", false], [CURSOS.soporte, "Rosa Vargas", 9, 15, "Despublicado", false]];
  return AD("Cursos", [
    cabeceraPortal(["Académico", "Cursos"], "Gestión de cursos", "Crea, edita, publica, despublica, duplica o elimina cursos.", [btn("Importar", { tipo: "contorno", icono: "upload" }), btn("Nuevo curso", { icono: "plus" })]),
    card([
      row([tabs([["Todos", 24], ["Publicados", 18], ["Borradores", 4], ["Despublicados", 2]], "Todos")], "padding:4px 20px 0"),
      row([campo("", "Buscar curso y presionar Enter", { icono: "search", ph: true, s: "width:340px" }), selector("", "Categoría: todas", { s: "width:200px" }), selector("", "Modalidad: todas", { s: "width:200px" }), selector("", "Instructor: todos", { s: "width:200px" })], "gap:12px;padding:16px 20px;border-bottom:1px solid var(--borde-default)"),
      tabla([["Curso", "grow"], ["Categoría", 150], ["Modalidad", 130], ["Precio", 80], ["Inscritos", 130], ["Estado", 120], ["", 24], ["Acciones", 110, "right"]], filas.map(([c, ins, a, b, e, dest]) => [
        row([portadaCurso(c.ic, { w: 48, h: 48, r: 10, t: 20, fondo: c.fondo }), col([txt(c.t, "t-sm"), ins ? txt(ins, "t-c c-ter") : badge("Sin instructor", "peligro")], "gap:2px")], "gap:12px"),
        txt(c.cat, "t-s c-sec"), badge(c.mod, tonoModalidad[c.mod]), txt(`S/ ${c.precio}`, "t-sm"),
        col([txt(`${a} / ${b}`, "t-s"), barra(Math.round((a / b) * 100), { s: true, ancho: 100 })], "gap:6px"),
        badge(e, est[e], true), span(ic("star", 18, dest ? "fill:var(--ambar-500)" : ""), "", `color:var(${dest ? "--ambar-500" : "--grafito-300"})`),
        row([btnIcono("pencil", { s: true, sinBorde: true }), btnIcono("copy", { s: true, sinBorde: true }), btnIcono("ellipsis", { s: true, sinBorde: true })], "gap:2px"),
      ])),
      paginacion("Mostrando 1–8 de 24 cursos"),
    ], "", "p0"),
  ]);
};

const categorias = () => {
  const cats = [["Programación", "Lógica, Python y fundamentos de software", "code", 8, 7], ["Desarrollo web", "HTML, CSS, JavaScript, React y Next.js", "globe", 6, 5], ["Datos y ofimática", "Excel, Power BI y bases de datos", "chart-column", 5, 4], ["Redes", "Cableado, configuración y administración", "signal", 4, 3], ["Ciberseguridad", "Protección de la información en empresas", "shield-check", 3, 3], ["Inteligencia artificial", "Modelos, automatización y herramientas de IA", "sparkles", 3, 1]];
  return AD("Categorías", [
    cabeceraPortal(["Académico", "Categorías"], "Categorías", "Agrupan los cursos del catálogo público.", [btn("Nueva categoría", { icono: "plus" })]),
    row([
      row(cats.map(([n, d, i, t, p]) => card([row([chipIc(i, { t: 44 }), row([btnIcono("pencil", { s: true }), btnIcono("trash", { s: true, color: "var(--rojo-600)" })], "gap:6px")], "", "between top"), col([txt(n, "t-h4"), txt(d, "t-s c-sec")], "gap:4px"), div("divisor", ""), col([txt(`${t} cursos · ${p} publicados`, "t-c c-sec"), txt(`/${n.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ /g, "-")}`, "mono c-ter")], "gap:4px")], "width:354px;gap:12px")), "gap:24px", "wrap top grow"),
      card([
        col([txt("Nueva categoría", "t-h4"), txt("Aparecerá como filtro en el catálogo público.", "t-s c-sec")], "gap:4px"),
        campo("Nombre", "Soporte técnico", { estado: "foco" }),
        campo("Slug", "soporte-tecnico", { ayuda: "pedsar.pe/cursos?categoria=soporte-tecnico" }),
        campo("Descripción", "Mantenimiento y reparación de equipos", { area: true }),
        col([txt("Ícono", "t-sm"), row(["monitor", "wrench", "cpu", "hard-drive", "printer", "server"].map((i, k) => div("", ic(i, 20), `width:44px;height:44px;border-radius:10px;display:flex;align-items:center;justify-content:center;${k === 0 ? "background:var(--fondo-marca-suave);color:var(--cian-800);border:2px solid var(--accion-primaria)" : "border:1px solid var(--borde-default);color:var(--texto-secundario)"}`)), "gap:8px", "wrap")], "gap:8px"),
        row([btn("Cancelar", { tipo: "contorno" }), btn("Crear categoría", { s: "flex:1" })], "gap:8px"),
      ], "width:340px;gap:16px", "nosh"),
    ], "gap:24px", "top"),
  ]);
};

const certificadosAdmin = () => {
  const aptos = [["AC", "Andrea Castillo", "19", "100%", true, true], ["DH", "Diego Hernández", "18", "96%", true, true], ["MQ", "María Quispe", "18", "100%", true, true], ["KS", "Kevin Saravia", "16", "92%", true, true], ["BF", "Bruno Flores", "15", "88%", true, true], ["JP", "Jorge Paredes", "12", "65%", false, false]];
  return AD("Certificados", [
    cabeceraPortal(["Académico", "Certificados"], "Certificados digitales", "Emisión individual o masiva con código único de verificación.", [btn("Emisión individual", { tipo: "contorno", icono: "plus" })]),
    row([kpi({ label: "Emitidos este mes", valor: "42", icono: "award", d: "+15%" }), kpi({ label: "Pendientes de emisión", valor: "12", icono: "hourglass", color: "var(--ambar-700)", fondo: "var(--ambar-50)", nota: "2 cursos finalizados" }), kpi({ label: "Verificaciones públicas", valor: "318", icono: "shield-check", color: "var(--verde-700)", fondo: "var(--verde-50)", nota: "Consultas en /verificar este mes" }), kpi({ label: "Revocados", valor: "0", icono: "ban", color: "var(--texto-secundario)", fondo: "var(--fondo-sutil)", nota: "Sin incidencias" })], "gap:16px", "stretch"),
    row([
      card([
        row([col([txt("Emisión masiva", "t-h4"), txt("Se emiten al completar el curso con nota ≥ 13 y asistencia ≥ 70%.", "t-s c-sec")], "gap:2px"), selector("", "Python desde cero · cohorte agosto", { s: "width:320px" })], "padding:20px", "between"),
        tabla([["", 24], ["Estudiante", "grow"], ["Nota final", 100, "center"], ["Asistencia", 110, "center"], ["Estado", 190]], aptos.map(([i, n, nf, a, ok, on], k) => [check("", on), persona(i, n, `${n.split(" ")[0].toLowerCase()}@correo.com`, tonos[k % 5]), txt(nf, `t-sm ${ok ? "" : "c-peligro"}`), txt(a, `t-s ${ok ? "" : "c-peligro"}`), ok ? badge("Apto", "exito", true) : badge("No apto · asistencia < 70%", "peligro")]), { sel: [0, 1, 2, 3, 4] }),
        row([row([check("", true), txt("5 de 6 seleccionados · los certificados se envían por correo", "t-s c-sec")], "gap:10px"), btn("Emitir 5 certificados", { icono: "award" })], "padding:16px 20px;border-top:1px solid var(--borde-default)", "between"),
      ], "", "p0 grow"),
      card([row([txt("Vista previa", "t-h4"), badge("Plantilla 2026", "cian")], "", "between"),
        col([row([div("", ic("graduation-cap", 16), "width:28px;height:28px;border-radius:8px;background:linear-gradient(135deg,var(--cian-400),var(--cian-700));color:#fff;display:flex;align-items:center;justify-content:center"), txt("PEDSAR", "t-sm")], "gap:8px"), txt("Certificado de aprobación", "t-o c-cian"), txt("Andrea Castillo Ramos", "t-h4 centro-t"), txt("Python desde cero · 40 h · Nota 19/20", "t-c c-sec centro-t"), row([txt("PED-2026-XXXXXXXX", "mono c-ter"), div("", ic("qr-code", 28), "color:var(--texto-primario)")], "gap:8px;margin-top:6px", "between")], "gap:8px;padding:20px;border:2px solid var(--cian-200);border-radius:10px;background:linear-gradient(180deg,#fff,var(--cian-50))", "acentro"),
        alerta("info", "info", "", "Cada certificado recibe un código único y un QR que apunta a /verificar."),
      ], "width:340px;gap:14px", "nosh"),
    ], "gap:24px", "top"),
    card([row([txt("Emitidos recientemente", "t-h4"), txt("Ver todos", "t-sm c-enl")], "padding:20px 20px 12px", "between"),
      tabla([["Código", 200], ["Estudiante", "grow"], ["Curso", 300], ["Emisión", 120], ["", 110, "right"]], [["PED-2026-7Q4K9X2M", "María Quispe", CURSOS.python.t, "15/08/2026"], ["PED-2026-P2M7C4TR", "Carlos Medina", CURSOS.excel.t, "14/08/2026"], ["PED-2026-Z8Q1L6NB", "Sofía Ramírez", CURSOS.redes.t, "12/08/2026"]].map(([c, n, cu, f], k) => [txt(c, "mono"), persona(n.split(" ").map((x) => x[0]).join(""), n, "", tonos[k % 5]), txt(cu, "t-s c-sec"), txt(f, "t-s"), row([btnIcono("download", { s: true, sinBorde: true }), btnIcono("link", { s: true, sinBorde: true }), btnIcono("ellipsis", { s: true, sinBorde: true })], "gap:2px")]))], "", "p0"),
  ]);
};

const inscripciones = () => {
  const pago = { Aprobado: "exito", Pendiente: "adv", Rechazado: "peligro", Reembolsado: "violeta" };
  const filas = [["#0482", "KS", "Kevin Saravia", CURSOS.react, "Yape", "288.00", "Pendiente", "Pendiente"], ["#0481", "NR", "Nicole Rojas", CURSOS.ciber, "Plin", "260.00", "Pendiente", "Pendiente"], ["#0480", "MQ", "María Quispe", CURSOS.react, "Yape", "288.00", "Aprobado", "Confirmada"], ["#0479", "DH", "Diego Hernández", CURSOS.sql, "Culqi", "200.00", "Aprobado", "Confirmada"], ["#0478", "LC", "Lucía Cárdenas", CURSOS.ia, "Izipay", "350.00", "Rechazado", "Cancelada"], ["#0477", "CG", "Camila Gutiérrez", CURSOS.excel, "Niubiz", "150.00", "Aprobado", "Confirmada"], ["#0476", "AC", "Andrea Castillo", CURSOS.python, "Yape", "162.00", "Aprobado", "Confirmada"]];
  const kv = (a, b) => row([txt(a, "t-s c-sec"), b], "padding:9px 0;border-bottom:1px solid var(--borde-default)", "between");
  return AD("Inscripciones y pagos", [
    cabeceraPortal(["Comercial", "Inscripciones y pagos"], "Inscripciones y pagos", "Confirma matrículas, verifica pagos y gestiona reembolsos.", [btn("Exportar", { tipo: "contorno", icono: "download" }), btn("Inscripción manual", { icono: "plus" })]),
    row([kpi({ label: "Inscripciones", valor: "128", icono: "users", d: "+12%" }), kpi({ label: "Pendientes de verificación", valor: "5", icono: "hourglass", color: "var(--ambar-700)", fondo: "var(--ambar-50)", nota: "Yape y Plin manuales" }), kpi({ label: "Ingresos del mes", valor: "S/ 24,860", icono: "wallet", color: "var(--verde-700)", fondo: "var(--verde-50)", d: "+8%" }), kpi({ label: "Reembolsos por atender", valor: "1", icono: "rotate-ccw", color: "var(--violeta-700)", fondo: "var(--violeta-50)", nota: "Plazo: 48 h" })], "gap:16px", "stretch"),
    row([
      card([
        row([tabs([["Todas", 128], ["Pendientes", 5], ["Confirmadas", 119], ["Canceladas", 4]], "Pendientes")], "padding:4px 20px 0"),
        row([campo("", "Buscar por estudiante, curso o N.º", { icono: "search", ph: true, s: "flex:1" }), selector("", "Método: todos", { s: "width:180px" })], "gap:12px;padding:16px 20px;border-bottom:1px solid var(--borde-default)"),
        tabla([["N.º", 56], ["Estudiante y curso", "grow"], ["Método", 150], ["Monto", 80], ["Pago", 110], ["", 32]], filas.map(([n, i, nom, c, m, v, p]) => [txt(n, "mono c-ter"), persona(i, nom, c.t, tonos[+n.slice(-1) % 5]), metodo(m), txt(`S/ ${v}`, "t-sm"), badge(p, pago[p], true), btnIcono("chevron-right", { s: true, sinBorde: true })]), { sel: [1] }),
        paginacion("Mostrando 1–7 de 128"),
      ], "", "p0 grow"),
      card([
        row([col([txt("Verificar pago #0481", "t-h4"), txt("Recibido hace 18 h", "t-c c-ter")], "gap:2px"), btnIcono("x", { s: true })], "", "between top"),
        persona("NR", "Nicole Rojas", "nicole.rojas@correo.com · DNI 72451890", "rosa"),
        col([kv("Curso", txt(CURSOS.ciber.t, "t-sm", "text-align:right;max-width:190px")), kv("Método", metodo("Plin")), kv("N.º de operación", txt("58201934", "mono")), kv("Monto declarado", txt("S/ 260.00", "t-sm")), kv("Comprobante", txt("Boleta · a emitir", "t-s"))]),
        col([txt("Captura enviada", "t-sm"), div("", [div("", [ic("circle-check", 28), txt("Plin · Pago exitoso", "t-sm"), txt("S/ 260.00", "t-h3"), txt("A: PEDSAR E.I.R.L. · 28/09 20:41", "t-c")], "width:160px;border-radius:14px;background:#fff;padding:16px;display:flex;flex-direction:column;align-items:center;gap:4px;color:#0E7490;box-shadow:var(--sombra-md)")], "height:220px;border-radius:12px;background:linear-gradient(160deg,#00A7B8,#0E7490);display:flex;align-items:center;justify-content:center")], "gap:8px"),
        alerta("adv", "triangle-alert", "", "Compara el N.º de operación con el estado de cuenta antes de aprobar."),
        row([btn("Rechazar", { tipo: "peligro-suave", icono: "x", s: "flex:1" }), btn("Aprobar pago", { icono: "check", s: "flex:1" })], "gap:8px"),
      ], "width:360px;gap:14px", "nosh"),
    ], "gap:24px", "top"),
    card([row([row([txt("Solicitudes de reembolso", "t-h4"), badge("1", "violeta")], "gap:8px")], "padding:20px 20px 12px"),
      tabla([["Solicitud", 90], ["Estudiante", "grow"], ["Motivo", 320], ["Monto", 100], ["Fecha", 110], ["", 200, "right"]], [[txt("#R-018", "mono c-ter"), persona("RH", "Renzo Huamaní", CURSOS.sql.t, "violeta"), txt("Cruce de horario con su trabajo; solicita cambio o devolución.", "t-s c-sec"), txt("S/ 200.00", "t-sm"), txt("27/09/2026", "t-s"), row([btn("Rechazar", { tipo: "fantasma", t: "s" }), btn("Aprobar", { tipo: "suave", t: "s", icono: "check" })], "gap:6px")]])], "", "p0"),
  ]);
};

const cupones = () => {
  const est = { Activo: "exito", Pausado: "neutro", Vencido: "peligro", Agotado: "adv" };
  const filas = [["BIENVENIDA10", 10, 38, null, "28/12/2026", "Todos los cursos", "Activo"], ["PEDSAR15", 15, 32, 50, "29/10/2026", "Todos los cursos", "Activo"], ["REACT20", 20, 12, 20, "15/10/2026", "React y Next.js", "Activo"], ["EMPRESA30", 30, 0, 10, "31/12/2026", "3 cursos", "Pausado"], ["FIESTASPATRIAS", 25, 60, 60, "31/07/2026", "Todos los cursos", "Agotado"], ["VERANO2026", 20, 18, 100, "31/03/2026", "Todos los cursos", "Vencido"]];
  return AD("Cupones", [
    cabeceraPortal(["Comercial", "Cupones"], "Cupones de descuento", "Códigos promocionales aplicables en la inscripción en línea.", [btn("Nuevo cupón", { icono: "plus" })]),
    row([kpi({ label: "Cupones activos", valor: "3", icono: "ticket-percent", nota: "de 6 creados" }), kpi({ label: "Usos este mes", valor: "46", icono: "users", d: "+21%" }), kpi({ label: "Descuento otorgado", valor: "S/ 1,380", icono: "wallet", color: "var(--rosa-600)", fondo: "var(--rosa-50)", nota: "Septiembre 2026" }), kpi({ label: "Conversión con cupón", valor: "27%", icono: "trending-up", color: "var(--verde-700)", fondo: "var(--verde-50)", nota: "de las inscripciones" })], "gap:16px", "stretch"),
    card([
      row([tabs([["Todos", 6], ["Activos", 3], ["Pausados", 1], ["Vencidos", 2]], "Todos"), campo("", "Buscar código", { icono: "search", ph: true, pequeño: true, s: "width:240px" })], "padding:4px 20px 0", "between base"),
      tabla([["Código", "grow"], ["Descuento", 100], ["Usos", 170], ["Vigente hasta", 130], ["Aplica a", 170], ["Estado", 110], ["Activo", 70], ["", 40]], filas.map(([c, d, u, m, f, a, e]) => [
        row([txt(c, "mono", "font-weight:600;padding:4px 10px;border-radius:6px;border:1px dashed var(--borde-fuerte);background:var(--fondo-pagina)"), btnIcono("copy", { s: true, sinBorde: true })], "gap:4px"),
        txt(`${d}%`, "t-bm"), col([txt(m ? `${u} / ${m}` : `${u} / ilimitado`, "t-s"), m ? barra(Math.round((u / m) * 100), { s: true, ancho: 130, tono: u >= m ? "adv" : "" }) : ""], "gap:6px"),
        txt(f, `t-s ${e === "Vencido" ? "c-peligro" : ""}`), txt(a, "t-s c-sec"), badge(e, est[e], true), sw(e === "Activo"), btnIcono("ellipsis", { s: true, sinBorde: true }),
      ])),
    ], "", "p0"),
    row([
      card([txt("Crear cupón", "t-h4"), row([campo("Código", "OCTUBRE20", { s: "flex:1", estado: "foco" }), btn("Generar", { tipo: "contorno", icono: "sparkles", s: "height:44px;align-self:flex-end" })], "gap:12px"), row([campo("Descuento (%)", "20", { s: "flex:1" }), campo("Usos máximos", "50", { s: "flex:1" }), campo("Vigente hasta", "31/10/2026", { icono: "calendar", s: "flex:1" })], "gap:12px"), selector("Aplica a", "Todos los cursos"), row([btn("Cancelar", { tipo: "contorno" }), btn("Crear cupón", { icono: "check" })], "gap:8px", "jfin")], "gap:16px", "grow"),
      card([txt("Vista previa en el checkout", "t-h4"), row([span(ic("ticket-percent", 18), "c-exito"), txt("OCTUBRE20 aplicado · −20%", "t-sm c-exito", "flex:1"), span(ic("x", 16), "c-exito")], "gap:8px;padding:12px;border-radius:8px;background:var(--verde-50);border:1px solid var(--verde-100)"), row([txt("Precio del curso", "t-s c-sec"), txt("S/ 320.00", "t-sm")], "", "between"), row([txt("Descuento", "t-s c-sec"), txt("− S/ 64.00", "t-sm c-exito")], "", "between"), div("divisor", ""), row([txt("Total", "t-bm"), txt("S/ 256.00", "t-h3")], "", "between")], "width:380px;gap:12px", "nosh"),
    ], "gap:24px", "stretch"),
  ]);
};

const usuarios = () => {
  const rol = { Administrador: "rosa", Instructor: "violeta", Estudiante: "cian" };
  const filas = [["AT", "Ana Torres", "admin@pedsar.pe", "Administrador", true, "12/01/2025", "Ahora", true], ["LR", "Luis Ramos", "luis.ramos@pedsar.pe", "Instructor", true, "03/02/2025", "Hace 2 h"], ["CT", "Carla Torres", "carla.torres@pedsar.pe", "Instructor", true, "03/02/2025", "Ayer"], ["MQ", "María Quispe", "maria.q@correo.com", "Estudiante", true, "01/06/2026", "Hace 15 min"], ["KS", "Kevin Saravia", "kevin.s@correo.com", "Estudiante", true, "15/03/2026", "Hace 3 días"], ["JP", "Jorge Paredes", "jorge.p@correo.com", "Estudiante", false, "20/05/2026", "Hace 1 mes"]];
  const P = { Gestionar: "cian", "Sus cursos": "violeta", Consultar: "neutro", Propios: "neutro", Rendir: "neutro", Emitir: "cian", Descargar: "neutro", Todos: "cian" };
  const perm = (v) => (v === "—" ? txt("—", "t-s c-ter") : badge(v, P[v]));
  return AD("Usuarios y roles", [
    cabeceraPortal(["Sistema", "Usuarios y roles"], "Usuarios y roles", "Invita, edita, desactiva usuarios y asigna roles con permisos diferenciados.", [btn("Invitar usuario", { icono: "user-plus" })]),
    card([
      row([tabs([["Todos", 342], ["Estudiantes", 318], ["Instructores", 21], ["Administradores", 3]], "Todos"), campo("", "Buscar usuario", { icono: "search", ph: true, pequeño: true, s: "width:260px" })], "padding:4px 20px 0", "between base"),
      tabla([["Usuario", "grow"], ["Rol", 170], ["Estado", 130], ["Registro", 110], ["Último acceso", 130], ["", 40]], filas.map(([i, n, e, r, act, reg, ult, yo], k) => [
        row([persona(i, n, e, tonos[k % 5]), yo ? badge("Tú", "neutro") : ""], "gap:8px"),
        row([badge(r, rol[r]), yo ? "" : span(ic("chevron-down", 14), "c-ter")], "gap:4px"),
        row([sw(act), txt(act ? "Activo" : "Inactivo", `t-s ${act ? "" : "c-ter"}`)], "gap:8px"), txt(reg, "t-s"), txt(ult, "t-s c-sec"), btnIcono("ellipsis", { s: true, sinBorde: true }),
      ])),
      paginacion("Mostrando 1–6 de 342 usuarios"),
    ], "", "p0"),
    card([row([col([txt("Permisos por rol", "t-h4"), txt("Aplicados en la interfaz y en la base de datos (políticas RLS de Supabase).", "t-s c-sec")], "gap:2px"), badge("Solo lectura", "neutro")], "padding:20px 20px 12px", "between"),
      tabla([["Módulo", "grow"], ["Administrador", 200], ["Instructor", 200], ["Estudiante", 200]], [["Catálogo y cursos", "Gestionar", "Consultar", "Consultar"], ["Inscripciones y pagos", "Gestionar", "—", "Propios"], ["Contenidos y sesiones", "Gestionar", "Sus cursos", "Consultar"], ["Evaluaciones y notas", "Gestionar", "Sus cursos", "Rendir"], ["Certificados", "Emitir", "Consultar", "Descargar"], ["Reportes y auditoría", "Todos", "—", "—"], ["Usuarios y roles", "Gestionar", "—", "—"]].map(([m, ...v]) => [txt(m, "t-sm"), ...v.map(perm)]))], "", "p0"),
  ]);
};

const auditoria = () => {
  const acc = (a) => { const t = a.includes("fallido") || a.includes("eliminar") ? "peligro" : a.includes("rol") || a.includes("exportar") ? "adv" : a.startsWith("pago") || a.startsWith("reembolso") ? "exito" : "cian"; return badge(`<span class="mono" style="font-size:12px">${a}</span>`, t); };
  const filas = [["29/09/2026 20:14:32", "AT", "Ana Torres", "pago.aprobar", "Pago #0480 · Yape · S/ 288.00 · María Quispe", "190.117.42.18"], ["29/09/2026 20:14:33", "—", "Sistema", "inscripcion.confirmar", "Inscripción #0480 confirmada automáticamente", "—"], ["29/09/2026 18:02:10", "LR", "Luis Ramos", "evaluacion.publicar", "«Módulo 2: Fundamentos de React» · 10 preguntas", "181.65.12.204"], ["29/09/2026 16:45:51", "AT", "Ana Torres", "usuario.rol_cambiar", "Carla Torres: estudiante → instructor", "190.117.42.18"], ["29/09/2026 15:30:07", "AT", "Ana Torres", "certificado.emitir", "5 certificados · Python desde cero (cohorte agosto)", "190.117.42.18"], ["29/09/2026 11:12:44", "?", "desconocido", "sesion.login_fallido", "3 intentos fallidos para admin@pedsar.pe", "45.231.8.77"], ["28/09/2026 22:08:19", "AT", "Ana Torres", "cupon.crear", "REACT20 · 20% · 20 usos · hasta 15/10/2026", "190.117.42.18"], ["28/09/2026 19:40:02", "AT", "Ana Torres", "curso.publicar", "Bases de datos con PostgreSQL", "190.117.42.18"], ["28/09/2026 10:21:36", "MQ", "María Quispe", "datos.exportar", "Exportó sus datos personales (Ley N.º 29733)", "179.7.214.90"], ["27/09/2026 17:55:13", "AT", "Ana Torres", "curso.eliminar", "Borrador «Excel básico 2025»", "190.117.42.18"]];
  return AD("Auditoría", [
    cabeceraPortal(["Sistema", "Auditoría"], "Registro de actividad", "Auditoría de acciones críticas del sistema (últimos 300 eventos).", [btn("Exportar", { tipo: "contorno", icono: "download" })]),
    card([
      row([campo("", "Buscar por usuario, acción o detalle", { icono: "search", ph: true, s: "flex:1" }), selector("", "Acción: todas", { s: "width:200px" }), selector("", "Usuario: todos", { s: "width:200px" }), campo("", "22/09 – 29/09/2026", { icono: "calendar", s: "width:230px" })], "gap:12px;padding:16px 20px;border-bottom:1px solid var(--borde-default)"),
      tabla([["Fecha y hora", 170], ["Usuario", 180], ["Acción", 210], ["Detalle", "grow"], ["Dirección IP", 140]], filas.map(([f, i, n, a, d, ip]) => [txt(f, "mono c-sec"), i === "—" || i === "?" ? row([div("avatar av-s", ic(i === "?" ? "triangle-alert" : "cpu", 14), i === "?" ? "background:var(--rojo-50);color:var(--rojo-700)" : "background:var(--grafito-100);color:var(--grafito-700)"), txt(n, "t-sm")], "gap:10px") : row([avatar(i, "s"), txt(n, "t-sm")], "gap:10px"), acc(a), txt(d, "t-s c-sec"), txt(ip, "mono c-ter")]), { sel: [5] }),
      paginacion("Mostrando 1–10 de 300 eventos"),
    ], "", "p0"),
  ]);
};

const pantallas = [
  { grupo: "Panel de administración", archivo: "admin-panel", titulo: "Admin · Panel", render: panel },
  { grupo: "Panel de administración", archivo: "admin-reportes", titulo: "Admin · Reportes", render: reportes },
  { grupo: "Panel de administración", archivo: "admin-cursos", titulo: "Admin · Cursos", render: cursos },
  { grupo: "Panel de administración", archivo: "admin-categorias", titulo: "Admin · Categorías", render: categorias },
  { grupo: "Panel de administración", archivo: "admin-certificados", titulo: "Admin · Certificados", render: certificadosAdmin },
  { grupo: "Panel de administración", archivo: "admin-inscripciones", titulo: "Admin · Inscripciones y pagos", render: inscripciones },
  { grupo: "Panel de administración", archivo: "admin-cupones", titulo: "Admin · Cupones", render: cupones },
  { grupo: "Panel de administración", archivo: "admin-usuarios", titulo: "Admin · Usuarios y roles", render: usuarios },
  { grupo: "Panel de administración", archivo: "admin-auditoria", titulo: "Admin · Auditoría", render: auditoria },
];

export default pantallas;
