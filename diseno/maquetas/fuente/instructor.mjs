// Portal del instructor.
import { alerta, badge, barra, btn, btnIcono, cabeceraPortal, campo, card, check, chipIc, col, CURSOS, div, ic, kpi, persona, portadaCurso, portal, radio, row, segmento, selector, span, sw, tabla, tabs, txt } from "./lib.mjs";

const D = (activo, contenido) => portal("instructor", activo, contenido);
const PYA = { t: "Python para análisis de datos", ic: "chart-column", fondo: "linear-gradient(135deg,#0891B2,#164E63)" };

const inicio = () => D("Inicio", [
  cabeceraPortal(["Instructor", "Inicio"], "Hola, Luis", "Hoy tienes 1 sesión y 3 estudiantes necesitan tu atención.", [btn("Subir material", { tipo: "contorno", icono: "upload" }), btn("Nueva sesión", { icono: "plus" })]),
  row([
    kpi({ label: "Cursos asignados", valor: "3", icono: "book-open", nota: "2 virtuales · 1 semipresencial" }),
    kpi({ label: "Estudiantes activos", valor: "58", icono: "users", d: "+6", nota: "este mes" }),
    kpi({ label: "Asistencia promedio", valor: "91%", icono: "user-check", color: "var(--verde-700)", fondo: "var(--verde-50)", d: "+2%", nota: "vs. mes anterior" }),
    kpi({ label: "Promedio general", valor: "15.8", icono: "graduation-cap", color: "var(--violeta-700)", fondo: "var(--violeta-50)", nota: "Escala vigesimal" }),
  ], "gap:16px", "stretch"),
  row([
    col([
      card([row([txt("Mis cursos", "t-h4"), txt("Ver contenidos", "t-sm c-enl")], "padding:20px 20px 12px", "between"),
        tabla([["Curso", "grow"], ["Inscritos", 70], ["Progreso medio", 150], ["Próxima sesión", 130], ["", 32]], [
          [row([portadaCurso(CURSOS.react.ic, { w: 40, h: 40, r: 8, t: 18, fondo: CURSOS.react.fondo }), col([txt(CURSOS.react.t, "t-sm"), badge("Semipresencial", "violeta")], "gap:4px")], "gap:12px"), txt("17 / 25", "t-s"), row([barra(62, { ancho: 110 }), txt("62%", "t-c c-ter")], "gap:8px"), txt("Jue 1 oct · 19:00", "t-s"), btnIcono("chevron-right", { s: true, sinBorde: true })],
          [row([portadaCurso(PYA.ic, { w: 40, h: 40, r: 8, t: 18, fondo: PYA.fondo }), col([txt(PYA.t, "t-sm"), badge("Virtual", "cian")], "gap:4px")], "gap:12px"), txt("24 / 30", "t-s"), row([barra(45, { ancho: 110 }), txt("45%", "t-c c-ter")], "gap:8px"), row([badge("Hoy", "rosa"), txt("19:00", "t-s")], "gap:6px"), btnIcono("chevron-right", { s: true, sinBorde: true })],
          [row([portadaCurso(CURSOS.sql.ic, { w: 40, h: 40, r: 8, t: 18, fondo: CURSOS.sql.fondo }), col([txt(CURSOS.sql.t, "t-sm"), badge("Virtual", "cian")], "gap:4px")], "gap:12px"), txt("17 / 30", "t-s"), row([barra(80, { ancho: 110 }), txt("80%", "t-c c-ter")], "gap:8px"), txt("Mié 30 set · 18:00", "t-s"), btnIcono("chevron-right", { s: true, sinBorde: true })],
        ])], "", "p0"),
      card([
        row([row([txt("Estudiantes en riesgo", "t-h4"), badge("3", "peligro")], "gap:8px"), txt("Ver todos", "t-sm c-enl")], "", "between"),
        ...[["JP", "Jorge Paredes", CURSOS.react.t, "Asistencia 58% · faltó a 3 sesiones", "rosa"], ["LC", "Lucía Cárdenas", PYA.t, "Promedio 10.5 · desaprobó 2 evaluaciones", "ambar"], ["RH", "Renzo Huamaní", CURSOS.sql.t, "Sin actividad hace 12 días", "violeta"]].map(([i, n, c, m, t]) =>
          row([persona(i, n, c, t), div("grow", ""), badge(m, "peligro"), btn("Contactar", { tipo: "contorno", t: "s", icono: "mail" })], "gap:12px;padding:12px 0;border-top:1px solid var(--borde-default)")),
      ], "gap:4px"),
    ], "gap:24px", "grow"),
    col([
      card([
        row([txt("Agenda de hoy", "t-h4"), txt("Mar 29 set", "t-sm c-ter")], "", "between"),
        row([col([txt("19:00", "t-sm"), txt("21:00", "t-c c-ter")], "gap:2px;width:44px"), div("", "", "width:3px;align-self:stretch;border-radius:999px;background:var(--accion-primaria)"), col([txt("Python para análisis de datos", "t-sm"), txt("Clase 8 · Pandas: agrupar y resumir", "t-c c-ter"), row([badge("Virtual", "cian"), txt("24 estudiantes", "t-c c-ter")], "gap:8px"), row([btn("Iniciar clase", { t: "s", icono: "video" }), btnIcono("copy", { s: true })], "gap:6px;margin-top:6px")], "gap:4px", "grow")], "gap:12px", "stretch"),
      ]),
      card([
        txt("Pendientes", "t-h4"),
        ...[[false, "Registrar asistencia de la sesión del lunes", "Python · Lun 28 set"], [false, "Publicar evaluación del módulo 3", "React y Next.js"], [true, "Subir guía de consultas SQL", "PostgreSQL · hecho ayer"]].map(([on, t, s]) => row([div("", check("", on), "padding-top:2px"), col([txt(t, on ? "t-s c-ter tachado" : "t-sm"), txt(s, "t-c c-ter")], "gap:2px", "grow")], "gap:10px", "top")),
      ], "gap:14px"),
      card([row([chipIc("star", { color: "var(--ambar-700)", fondo: "var(--ambar-50)" }), col([txt("4.9 de valoración", "t-sm"), txt("86 reseñas de estudiantes este año", "t-c c-ter")], "gap:2px")], "gap:12px")]),
    ], "gap:24px;width:360px", "nosh"),
  ], "gap:24px", "top"),
]);

const contenidos = () => {
  const tipoIc = { PDF: ["file-text", "--rojo-600", "--rojo-50"], VIDEO: ["video", "--violeta-600", "--violeta-50"], ENLACE: ["link", "--cian-700", "--cian-50"] };
  const mat = (tipo, t, meta, vis = true) => { const [i, c, f] = tipoIc[tipo]; return row([span(ic("grip-vertical", 16), "c-ter"), chipIc(i, { t: 36, color: `var(${c})`, fondo: `var(${f})` }), col([txt(t, "t-sm"), txt(meta, "t-c c-ter")], "gap:2px", "grow"), badge(tipo, "neutro"), row([sw(vis), txt(vis ? "Visible" : "Oculto", "t-c c-sec")], "gap:8px;width:92px"), btnIcono("ellipsis", { s: true, sinBorde: true })], "gap:12px;padding:12px 20px;border-top:1px solid var(--borde-default)"); };
  const modulo = (n, t, sub, hijos) => card([row([span(ic("grip-vertical", 18), "c-ter"), div("", txt(n, "t-sm", "color:var(--cian-800)"), "width:32px;height:32px;border-radius:8px;background:var(--fondo-marca-suave);display:flex;align-items:center;justify-content:center"), col([txt(t, "t-bm"), txt(sub, "t-c c-ter")], "", "grow"), btn("Agregar material", { tipo: "fantasma", t: "s", icono: "plus" }), btnIcono("pencil", { s: true }), btnIcono("trash", { s: true, color: "var(--rojo-600)" })], "gap:12px;padding:16px 20px"), ...hijos], "", "p0");
  return D("Contenidos", [
    cabeceraPortal(["Instructor", "Contenidos"], "Contenidos del curso", "Organiza materiales (PDF, videos y enlaces) por módulos.", [selector("", CURSOS.react.t, { s: "width:320px", icono: "book-open" }), btn("Nuevo módulo", { icono: "plus" })]),
    row([
      col([
        modulo("1", "Introducción y entorno de trabajo", "4 materiales · visible para 17 estudiantes", [mat("VIDEO", "Instalación de Node.js y VS Code", "Video · 45 min · publicado el 8 set"), mat("PDF", "Guía: estructura de un proyecto Next.js", "PDF · 1.8 MB · publicado el 8 set"), mat("ENLACE", "Documentación oficial de React", "react.dev · publicado el 9 set"), mat("VIDEO", "Grabación: tu primer componente", "Video · 1 h 40 min · publicado el 10 set")]),
        modulo("2", "Fundamentos y práctica guiada", "5 materiales · 1 oculto", [mat("PDF", "Guía de hooks en React", "PDF · 2.4 MB · publicado el 24 set"), mat("VIDEO", "Grabación de la clase en vivo (24 set)", "Video · 1 h 52 min"), mat("ENLACE", "Ejercicios en CodeSandbox", "codesandbox.io"), mat("PDF", "Solucionario de ejercicios", "PDF · 900 KB · programado para el 3 oct", false)]),
        modulo("3", "Proyecto final", "Sin materiales todavía", [div("", [txt("Sin materiales todavía.", "t-sm c-sec"), btn("Agregar el primer material", { tipo: "suave", t: "s", icono: "plus" })], "margin:0 20px 20px;padding:24px;border:1px dashed var(--borde-fuerte);border-radius:12px;display:flex;flex-direction:column;align-items:center;gap:10px")]),
      ], "gap:16px", "grow"),
      card([
        col([txt("Agregar material", "t-h4"), txt("Módulo 2 · Fundamentos y práctica guiada", "t-c c-ter")], "gap:2px"),
        segmento([["PDF", "file-text"], ["Video", "video"], ["Enlace", "link"]], "PDF"),
        campo("Título", "Ejercicios resueltos de hooks"),
        div("dropzona", [chipIc("upload", { t: 44 }), txt("Arrastra tu PDF aquí o <span class='c-enl'>búscalo</span>", "t-sm"), txt("Máximo 20 MB", "t-c c-ter")]),
        row([chipIc("file-text", { t: 36, color: "var(--rojo-600)", fondo: "var(--rojo-50)" }), col([row([txt("ejercicios-hooks.pdf", "t-sm"), txt("64%", "t-c c-ter")], "", "between"), barra(64, { s: true })], "gap:6px", "grow"), btnIcono("x", { s: true, sinBorde: true })], "gap:12px;padding:12px;border:1px solid var(--borde-default);border-radius:10px"),
        row([sw(true), txt("Notificar a los estudiantes", "t-s")], "gap:10px"),
        row([btn("Cancelar", { tipo: "contorno" }), btn("Publicar material", { s: "flex:1" })], "gap:8px"),
      ], "width:360px;gap:16px", "nosh"),
    ], "gap:24px", "top"),
  ]);
};

const sesiones = () => {
  const H = 44, INI = 8;
  const dias = [["Lun", "28"], ["Mar", "29", true], ["Mié", "30"], ["Jue", "1"], ["Vie", "2"], ["Sáb", "3"]];
  const bloques = { 0: [[19, 21, PYA.t, "Virtual", true]], 1: [[19, 21, PYA.t, "Virtual"]], 2: [[18, 20, "Bases de datos con PostgreSQL", "Virtual"]], 3: [[19, 21, "React · Clase 6: Formularios", "Virtual"]], 4: [[18, 20, "Bases de datos con PostgreSQL", "Virtual"]], 5: [[9, 12, "React · Taller práctico", "Presencial"]] };
  const colores = { Virtual: ["--cian-50", "--cian-700", "--cian-800"], Presencial: ["--violeta-50", "--violeta-600", "--violeta-700"] };
  const horas = Array.from({ length: 14 }, (_, i) => INI + i);
  const colDia = (i) => col([
    div("", [txt(dias[i][0], "t-c", dias[i][2] ? "color:var(--cian-100)" : "color:var(--texto-terciario)"), txt(dias[i][1], "t-h4", dias[i][2] ? "color:#fff" : "")], `height:64px;display:flex;flex-direction:column;align-items:center;justify-content:center;border-bottom:1px solid var(--borde-default);${dias[i][2] ? "background:var(--accion-primaria);color:#fff" : ""}`),
    div("", [...horas.map(() => div("", "", `height:${H}px;border-bottom:1px solid var(--grafito-100)`)), ...(bloques[i] || []).map(([a, b, t, m, hecha]) => { const [f, borde, tc] = colores[m]; return div("", [txt(t, "t-c", `color:var(${tc});font-weight:600`), txt(`${a}:00 – ${b}:00 · ${m}`, "t-c", `color:var(${tc});opacity:.8`)], `position:absolute;left:6px;right:6px;top:${(a - INI) * H + 2}px;height:${(b - a) * H - 4}px;border-radius:8px;background:var(${f});border-left:3px solid var(${borde});padding:6px 8px;display:flex;flex-direction:column;gap:2px;${hecha ? "opacity:.55" : ""}`); })], "position:relative"),
  ], `flex:1 1 0;border-left:1px solid var(--borde-default);${dias[i][2] ? "background:rgba(6,182,212,0.04)" : ""}`);
  const calendario = card([
    row([row([btnIcono("chevron-left", { s: true }), btnIcono("chevron-right", { s: true }), txt("28 set – 3 oct 2026", "t-h4"), btn("Hoy", { tipo: "contorno", t: "s" })], "gap:8px"), row([row([div("", "", "width:10px;height:10px;border-radius:3px;background:var(--cian-600)"), txt("Virtual", "t-c c-sec")], "gap:6px"), row([div("", "", "width:10px;height:10px;border-radius:3px;background:var(--violeta-600)"), txt("Presencial", "t-c c-sec")], "gap:6px"), row([div("", "", "width:10px;height:10px;border-radius:3px;background:var(--grafito-300)"), txt("Realizada", "t-c c-sec")], "gap:6px")], "gap:16px")], "padding:16px 20px;border-bottom:1px solid var(--borde-default)", "between"),
    row([col([div("", "", "height:64px;border-bottom:1px solid var(--borde-default)"), ...horas.map((h) => div("", txt(`${String(h).padStart(2, "0")}:00`, "t-c c-ter"), `height:${H}px;padding:0 10px;transform:translateY(-8px)`))], "width:64px;flex-shrink:0"), ...dias.map((_, i) => colDia(i))], "", "stretch"),
  ], "", "p0");
  return D("Sesiones y horarios", [
    cabeceraPortal(["Instructor", "Sesiones y horarios"], "Sesiones y horarios", "Programa clases presenciales, virtuales o semipresenciales.", [segmento([["Semana", "calendar-days"], ["Lista", "list"]], "Semana"), btn("Nueva sesión", { icono: "plus" })]),
    tabs([["Próximas", 8], ["Realizadas", 12]], "Próximas"),
    calendario,
    card([txt("Próximas sesiones", "t-h4", "padding:20px 20px 8px"), tabla([["Fecha", 150], ["Curso", "grow"], ["Horario", 140], ["Modalidad", 130], ["Enlace o lugar", 240], ["", 80, "right"]], [
      [row([badge("Hoy", "rosa"), txt("Mar 29 set", "t-s")], "gap:6px"), txt(PYA.t, "t-sm"), txt("19:00 – 21:00", "t-s"), badge("Virtual", "cian"), row([span(ic("video", 16), "c-enl"), txt("zoom.us/j/8420…", "t-s c-enl")], "gap:6px"), row([btnIcono("pencil", { s: true, sinBorde: true }), btnIcono("trash", { s: true, sinBorde: true })], "gap:2px")],
      [txt("Mié 30 set", "t-s"), txt(CURSOS.sql.t, "t-sm"), txt("18:00 – 20:00", "t-s"), badge("Virtual", "cian"), row([span(ic("video", 16), "c-enl"), txt("zoom.us/j/7731…", "t-s c-enl")], "gap:6px"), row([btnIcono("pencil", { s: true, sinBorde: true }), btnIcono("trash", { s: true, sinBorde: true })], "gap:2px")],
      [txt("Sáb 3 oct", "t-s"), txt(CURSOS.react.t, "t-sm"), txt("09:00 – 12:00", "t-s"), badge("Presencial", "violeta"), row([span(ic("map-pin", 16), "c-ter"), txt("Sede Ica · Aula 2", "t-s c-sec")], "gap:6px"), row([btnIcono("pencil", { s: true, sinBorde: true }), btnIcono("trash", { s: true, sinBorde: true })], "gap:2px")],
    ])], "", "p0"),
  ]);
};

const asistencia = () => {
  const estado = (e) => `<div class="segmento" style="padding:3px">${[["Presente", "check", "--verde-600"], ["Tardanza", "clock", "--ambar-500"], ["Ausente", "x", "--rojo-600"]].map(([n, i, c]) => `<div style="height:30px;${n === e ? `background:var(${c});color:#fff;box-shadow:var(--sombra-sm)` : ""}">${ic(i, 14)}${n}</div>`).join("")}</div>`;
  const alumnos = [["AC", "Andrea Castillo", 100, "Presente"], ["BF", "Bruno Flores", 92, "Presente"], ["CG", "Camila Gutiérrez", 85, "Tardanza"], ["DH", "Diego Hernández", 100, "Presente"], ["JP", "Jorge Paredes", 58, "Ausente"], ["KS", "Kevin Saravia", 92, "Presente"], ["MQ", "María Quispe", 92, "Presente"], ["NR", "Nicole Rojas", 77, "Tardanza"]];
  const tonos = ["", "rosa", "violeta", "ambar", "verde"];
  return D("Asistencia", [
    cabeceraPortal(["Instructor", "Asistencia"], "Registro de asistencia", "Marca la asistencia de cada estudiante en la sesión.", [btn("Exportar", { tipo: "contorno", icono: "download" })]),
    row([selector("Curso", CURSOS.react.t, { s: "width:340px" }), selector("Sesión", "Jue 24 set · Clase 5 · Presencial", { s: "width:320px" }), div("grow", ""), ...[["Presentes", "14", "exito"], ["Tardanzas", "2", "adv"], ["Ausentes", "1", "peligro"]].map(([t, n, tono]) => row([txt(n, "t-h3"), badge(t, tono, true)], "gap:10px;padding:10px 16px;border-radius:12px;background:#fff;border:1px solid var(--borde-default)"))], "gap:16px", "base"),
    card([
      row([row([txt("17 estudiantes", "t-h4"), txt("· mostrando 8", "t-s c-ter")], "gap:6px"), row([campo("", "Buscar estudiante", { icono: "search", ph: true, pequeño: true, s: "width:240px" }), btn("Marcar todos presentes", { tipo: "suave", t: "m", icono: "check-check" })], "gap:8px")], "padding:16px 20px", "between"),
      tabla([["#", 32], ["Estudiante", "grow"], ["Asistencia acumulada", 200], ["Estado en esta sesión", 320], ["Observación", 220]], alumnos.map(([i, n, p, e], k) => [
        txt(String(k + 1), "t-s c-ter"), persona(i, n, `${n.split(" ")[0].toLowerCase()}@correo.com`, tonos[k % 5]),
        row([barra(p, { ancho: 110, tono: p < 70 ? "peligro" : p < 85 ? "adv" : "exito" }), txt(`${p}%`, "t-sm")], "gap:10px"), estado(e),
        campo("", e === "Tardanza" ? "Llegó 19:20" : e === "Ausente" ? "Sin justificación" : "Opcional", { pequeño: true, ph: e === "Presente", s: "width:220px" }),
      ]), { sel: [4] }),
    ], "", "p0"),
    row([row([span(ic("info", 18), "c-cian"), txt("3 cambios sin guardar", "t-sm")], "gap:10px"), row([btn("Descartar", { tipo: "fantasma" }), btn("Guardar asistencia", { icono: "check" })], "gap:8px")], "padding:14px 20px;border-radius:12px;background:#fff;border:1px solid var(--cian-200);box-shadow:var(--sombra-lg)", "between"),
  ]);
};

const evaluaciones = () => {
  const opcion = (t, ok) => row([radio(ok), div("", txt(t, "t-b"), `flex:1;height:44px;border-radius:8px;border:1px solid var(${ok ? "--verde-600" : "--borde-fuerte"});background:var(${ok ? "--verde-50" : "--fondo-superficie"});display:flex;align-items:center;padding:0 12px`), ok ? badge("Respuesta correcta", "exito", true) : "", btnIcono("x", { s: true, sinBorde: true })], "gap:12px");
  return D("Evaluaciones", [
    cabeceraPortal(["Instructor", "Evaluaciones"], "Evaluaciones", "Crea evaluaciones de opción múltiple con puntaje, tiempo límite e intentos."),
    tabs([["Mis evaluaciones", 4], "Crear evaluación"], "Crear evaluación"),
    row([
      card([
        txt("Configuración", "t-h4"),
        campo("Título", "Módulo 3: Rutas y datos"),
        selector("Curso", CURSOS.react.t),
        row([campo("Tiempo (min)", "20", { icono: "timer", s: "flex:1" }), campo("Intentos", "2", { s: "flex:1" })], "gap:12px"),
        row([campo("Nota mínima", "13", { s: "flex:1" }), campo("Disponible hasta", "10/10/2026", { icono: "calendar", s: "flex:1" })], "gap:12px"),
        div("divisor", ""),
        row([col([txt("Mezclar preguntas", "t-sm"), txt("Orden aleatorio por intento", "t-c c-ter")], "", "grow"), sw(true)], "gap:12px"),
        row([col([txt("Mostrar respuestas al finalizar", "t-sm"), txt("Retroalimentación inmediata", "t-c c-ter")], "", "grow"), sw(false)], "gap:12px"),
        div("divisor", ""),
        row([txt("Resumen", "t-s c-sec"), txt("5 preguntas · 20 puntos", "t-sm")], "", "between"),
        col([btn("Publicar evaluación", { icono: "send", block: true }), btn("Guardar borrador", { tipo: "contorno", block: true })], "gap:8px"),
      ], "width:340px;gap:14px", "nosh"),
      col([
        alerta("info", "info", "", "Marca la opción correcta con el círculo. Cada pregunta necesita al menos 2 opciones y una respuesta correcta."),
        card([
          row([span(ic("grip-vertical", 18), "c-ter"), badge("Pregunta 1", "cian"), div("grow", ""), campo("", "4 pts", { pequeño: true, s: "width:90px" }), btnIcono("copy", { s: true }), btnIcono("trash", { s: true, color: "var(--rojo-600)" })], "gap:8px"),
          campo("Enunciado", "¿Qué archivo define una ruta en el App Router de Next.js?"),
          col([opcion("page.tsx", true), opcion("route.config.js", false), opcion("index.html", false), opcion("router.ts", false)], "gap:10px"),
          txt("+ Agregar opción", "t-sm c-enl"),
        ], "gap:16px;border-color:var(--cian-300);box-shadow:var(--anillo)"),
        ...[["2", "¿Qué hook usarías para ejecutar código después del renderizado?", "4 opciones · 4 pts"], ["3", "En Next.js, ¿dónde se definen los layouts compartidos?", "4 opciones · 4 pts"], ["4", "¿Qué función devuelve un 404 desde un Server Component?", "3 opciones · 4 pts"], ["5", "¿Cuál es la ventaja principal del renderizado en servidor?", "4 opciones · 4 pts"]].map(([n, t, s]) =>
          card([row([span(ic("grip-vertical", 18), "c-ter"), badge(`Pregunta ${n}`, "neutro"), col([txt(t, "t-sm"), txt(s, "t-c c-ter")], "gap:2px", "grow"), badge("Completa", "exito", true), btnIcono("chevron-down", { s: true, sinBorde: true })], "gap:12px")], "padding:16px 20px")),
        div("", [ic("plus", 18), txt("Agregar pregunta", "t-sm")], "height:56px;border:2px dashed var(--borde-fuerte);border-radius:12px;display:flex;align-items:center;justify-content:center;gap:8px;color:var(--texto-enlace)"),
      ], "gap:12px", "grow"),
    ], "gap:24px", "top"),
  ]);
};

const notas = () => {
  const est = [["AC", "Andrea Castillo", 100, 92, 18, 19, 18.5, "Destacado", "exito"], ["BF", "Bruno Flores", 92, 78, 15, 16, 15.5, "Regular", "cian"], ["CG", "Camila Gutiérrez", 85, 70, 14, 13, 13.5, "Regular", "cian"], ["DH", "Diego Hernández", 100, 88, 17, 18, 17.5, "Destacado", "exito"], ["JP", "Jorge Paredes", 58, 35, 9, 11, 10.0, "En riesgo", "peligro"], ["KS", "Kevin Saravia", 92, 81, 16, 15, 15.5, "Regular", "cian"], ["MQ", "María Quispe", 92, 68, 17, "—", 17.0, "Regular", "cian"], ["NR", "Nicole Rojas", 77, 55, 12, 12, 12.0, "En riesgo", "peligro"]];
  const tonos = ["", "rosa", "violeta", "ambar", "verde"];
  const nota = (n) => txt(String(n), `t-sm ${typeof n === "number" && n < 13 ? "c-peligro" : ""}`);
  return D("Estudiantes y notas", [
    cabeceraPortal(["Instructor", "Estudiantes y notas"], "Estudiantes y calificaciones", "", [selector("", CURSOS.react.t, { s: "width:320px", icono: "book-open" }), btn("Exportar notas", { tipo: "contorno", icono: "download" })]),
    row([kpi({ label: "Estudiantes", valor: "17", icono: "users", nota: "de 25 cupos" }), kpi({ label: "Promedio del curso", valor: "15.2", icono: "graduation-cap", d: "+0.8", nota: "vs. módulo anterior" }), kpi({ label: "Asistencia media", valor: "89%", icono: "user-check", color: "var(--verde-700)", fondo: "var(--verde-50)", nota: "11 sesiones realizadas" }), kpi({ label: "En riesgo", valor: "2", icono: "triangle-alert", color: "var(--rojo-700)", fondo: "var(--rojo-50)", nota: "Asistencia < 70% o promedio < 13" })], "gap:16px", "stretch"),
    card([
      row([tabs([["Todos", 17], ["Destacados", 4], ["En riesgo", 2]], "Todos"), campo("", "Buscar estudiante", { icono: "search", ph: true, pequeño: true, s: "width:260px" })], "padding:4px 20px 0", "between base"),
      tabla([["Estudiante", "grow"], ["Asistencia", 150], ["Progreso", 150], ["Ev. 1", 60, "center"], ["Ev. 2", 60, "center"], ["Promedio", 90, "center"], ["Estado", 120], ["", 40]], est.map(([i, n, a, p, e1, e2, pr, st, tono], k) => [
        persona(i, n, `${n.split(" ")[0].toLowerCase()}@correo.com`, tonos[k % 5]),
        row([barra(a, { ancho: 80, tono: a < 70 ? "peligro" : a < 85 ? "adv" : "exito" }), txt(`${a}%`, "t-s")], "gap:8px"),
        row([barra(p, { ancho: 80 }), txt(`${p}%`, "t-s")], "gap:8px"),
        nota(e1), nota(e2), txt(pr.toFixed(1), `t-bm ${pr < 13 ? "c-peligro" : ""}`), badge(st, tono, true), btnIcono("ellipsis", { s: true, sinBorde: true }),
      ]), { sel: [4, 7] }),
    ], "", "p0"),
  ]);
};

const pantallas = [
  { grupo: "Portal del instructor", archivo: "instructor-inicio", titulo: "Instructor · Inicio", render: inicio },
  { grupo: "Portal del instructor", archivo: "instructor-contenidos", titulo: "Instructor · Contenidos", render: contenidos },
  { grupo: "Portal del instructor", archivo: "instructor-sesiones", titulo: "Instructor · Sesiones y horarios", render: sesiones },
  { grupo: "Portal del instructor", archivo: "instructor-asistencia", titulo: "Instructor · Asistencia", render: asistencia },
  { grupo: "Portal del instructor", archivo: "instructor-evaluaciones", titulo: "Instructor · Crear evaluación", render: evaluaciones },
  { grupo: "Portal del instructor", archivo: "instructor-notas", titulo: "Instructor · Estudiantes y notas", render: notas },
];

export default pantallas;
