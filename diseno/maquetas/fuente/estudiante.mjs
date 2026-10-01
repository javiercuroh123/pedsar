// Portal del estudiante.
import { alerta, badge, barra, btn, btnIcono, cabeceraPortal, card, chipIc, col, CURSOS, div, fechaBloque, ic, kpi, logo, portadaCurso, portal, radio, row, span, tabla, tabs, tonoModalidad, txt } from "./lib.mjs";

const E = (activo, contenido) => portal("estudiante", activo, contenido);
const kv = (a, b) => row([txt(a, "t-s c-sec"), txt(b, "t-sm")], "padding:10px 0;border-bottom:1px solid var(--borde-default)", "between");

const sesion = (d, m, titulo, hora, mod, accion) =>
  row([fechaBloque(d, m), col([txt(titulo, "t-sm"), row([span(ic("clock", 14), "c-ter"), txt(hora, "t-c c-ter")], "gap:6px"), row([badge(mod, tonoModalidad[mod] || "neutro"), accion || ""], "gap:8px;margin-top:4px")], "gap:4px", "grow")], "gap:14px", "top");

const inicio = () => E("Inicio", [
  cabeceraPortal(["Estudiante", "Inicio"], "¡Qué bueno verte, María!", "Tienes 1 evaluación pendiente y una clase el jueves.", [btn("Explorar cursos", { tipo: "contorno", icono: "search" })]),
  row([
    kpi({ label: "Cursos activos", valor: "2", icono: "book-open", nota: "1 finalizado este año" }),
    kpi({ label: "Progreso promedio", valor: "64%", icono: "trending-up", d: "+9%", nota: "vs. semana pasada" }),
    kpi({ label: "Asistencia", valor: "92%", icono: "user-check", color: "var(--verde-700)", fondo: "var(--verde-50)", nota: "11 de 12 sesiones" }),
    kpi({ label: "Certificados", valor: "1", icono: "award", color: "var(--rosa-600)", fondo: "var(--rosa-50)", nota: "Verificable con QR" }),
  ], "gap:16px", "stretch"),
  row([
    col([
      card([
        row([txt("Continúa donde lo dejaste", "t-h4"), txt("Ver todos mis cursos", "t-sm c-enl")], "", "between"),
        row([
          div("portada", [ic("globe", 56), div("", ic("circle-play", 28), "position:absolute;width:56px;height:56px;border-radius:999px;background:#fff;color:var(--accion-primaria);display:flex;align-items:center;justify-content:center;box-shadow:var(--sombra-md);right:16px;bottom:16px")], "width:260px;height:168px;border-radius:12px;position:relative"),
          col([
            row([badge("Módulo 2 · Fundamentos", "cian"), badge("Semipresencial", "violeta")], "gap:8px"),
            txt(CURSOS.react.t, "t-h3"),
            txt("Clase 5 · Hooks: useState y useEffect", "t-b c-sec"),
            col([row([txt("68% completado", "t-sm"), txt("12 de 18 clases", "t-c c-ter")], "", "between"), barra(68)], "gap:8px;margin-top:4px"),
            row([btn("Continuar clase", { icono: "circle-play" }), btn("Ver materiales", { tipo: "contorno", icono: "folder-open" })], "gap:8px;margin-top:4px"),
          ], "gap:8px", "grow"),
        ], "gap:24px", "top"),
      ]),
      card([
        row([chipIc("clipboard-check", { color: "var(--ambar-700)", fondo: "var(--ambar-50)" }), col([row([txt("Evaluación pendiente", "t-h4"), badge("Vence en 4 días", "adv", true)], "gap:10px"), txt("Módulo 2: Fundamentos de React · 10 preguntas · 20 min · 2 intentos", "t-s c-sec")], "gap:4px", "grow"), btn("Comenzar", { iconoDer: "arrow-right" })], "gap:16px"),
      ]),
      card([
        txt("Mis cursos", "t-h4"),
        ...[[CURSOS.react, 68, "Próxima sesión: jue 1 oct, 19:00", "", "En curso"], [CURSOS.excel, 35, "Próxima sesión: sáb 3 oct, 09:00", "", "En curso"], [CURSOS.python, 100, "Finalizado el 10 ago · Nota 18/20", "exito", "Finalizado"]].map(([c, p, sub, tono, est]) =>
          row([portadaCurso(c.ic, { w: 56, h: 56, t: 24, fondo: c.fondo }), col([row([txt(c.t, "t-sm"), badge(est, est === "Finalizado" ? "exito" : "cian")], "gap:8px"), txt(sub, "t-c c-ter")], "gap:4px", "grow"), col([barra(p, { tono, ancho: 160 }), txt(`${p}%`, "t-c c-ter", "text-align:right")], "gap:6px"), btnIcono("chevron-right", { s: true, sinBorde: true })], "gap:16px;padding:12px 0;border-top:1px solid var(--borde-default)")),
      ], "gap:4px"),
    ], "gap:24px", "grow"),
    col([
      card([
        row([txt("Próximas sesiones", "t-h4"), txt("Calendario", "t-sm c-enl")], "", "between"),
        sesion("01", "Oct", "React · Clase 6: Formularios", "Jueves · 19:00 – 21:00", "Virtual", btn("Unirse", { tipo: "suave", t: "s", icono: "video" })),
        div("divisor", ""),
        sesion("03", "Oct", "Excel · Tablas dinámicas", "Sábado · 09:00 – 12:00", "Presencial"),
        div("divisor", ""),
        sesion("06", "Oct", "React · Clase 7: Rutas y layouts", "Martes · 19:00 – 21:00", "Presencial"),
      ]),
      card([
        row([chipIc("circle-check", { color: "var(--verde-700)", fondo: "var(--verde-50)" }), col([txt("Estás al día con tus pagos", "t-sm"), txt("Último pago: S/ 288.00 con Yape · 29 set", "t-c c-ter")], "gap:2px", "grow")], "gap:12px"),
        btn("Ver comprobantes", { tipo: "contorno", icono: "receipt", block: true }),
      ]),
      card([
        txt("Tu último logro", "t-h4"),
        row([chipIc("award", { t: 48, color: "var(--rosa-600)", fondo: "var(--rosa-50)" }), col([txt("Certificado: Python desde cero", "t-sm"), txt("PED-2026-7Q4K9X2M · Nota 18/20", "t-c c-ter")], "gap:2px", "grow")], "gap:12px"),
        row([btn("Descargar", { tipo: "suave", t: "s", icono: "download" }), btn("Compartir", { tipo: "fantasma", t: "s", icono: "share-2" })], "gap:8px"),
      ]),
    ], "gap:24px;width:360px", "nosh"),
  ], "gap:24px", "top"),
]);

const misCursos = () => {
  const fila = (c, p, prox, instr) => card([row([
    div("portada", ic(c.ic, 44), `width:200px;height:136px;border-radius:12px;background:${c.fondo}`),
    col([
      txt(c.cat, "t-o c-cian"), txt(c.t, "t-h4"),
      row([span(ic("user-round", 14), "c-ter"), txt(`Instructor: ${instr}`, "t-s c-sec"), span("·", "c-ter"), badge(c.mod, tonoModalidad[c.mod]), badge(c.niv, "neutro")], "gap:8px"),
      row([span(ic("calendar-days", 14), "c-ter"), txt(prox, "t-s c-sec")], "gap:8px"),
      row([barra(p, { ancho: 360 }), txt(`${p}% completado`, "t-sm")], "gap:12px;margin-top:4px"),
    ], "gap:6px", "grow"),
    col([btn("Ir al aula", { icono: "circle-play" }), btn("Materiales", { tipo: "contorno", icono: "folder-open" })], "gap:8px"),
  ], "gap:24px")], "padding:20px");
  return E("Mis cursos", [
    cabeceraPortal(["Estudiante", "Mis cursos"], "Mis cursos", "Estado de tus inscripciones, avance y certificados.", [btn("Explorar catálogo", { tipo: "contorno", icono: "search" })]),
    tabs([["En curso", 2], ["Finalizados", 1], ["Pendientes de pago", 1]], "En curso"),
    fila(CURSOS.react, 68, "Próxima sesión: jueves 1 de octubre · 19:00 (Zoom)", "Luis Ramos"),
    fila(CURSOS.excel, 35, "Próxima sesión: sábado 3 de octubre · 09:00 (Sede Ica)", "Carla Torres"),
    col([txt("Pendientes de pago", "t-h4"),
      card([row([portadaCurso(CURSOS.ciber.ic, { w: 64, h: 64, fondo: CURSOS.ciber.fondo }), col([txt(CURSOS.ciber.t, "t-bm"), txt("Pago con Plin enviado el 28 set · S/ 260.00", "t-s c-sec")], "gap:4px", "grow"), badge("Pendiente de validación", "adv", true), btn("Ver pago", { tipo: "contorno", t: "s" })], "gap:16px"), alerta("info", "info", "", "Validamos los pagos con Plin en menos de 24 horas hábiles. Te avisaremos por correo cuando tu acceso esté activo.")]),
    ], "gap:12px;margin-top:8px"),
  ]);
};

const aula = () => {
  const leccion = (estado, t, dur, actual) => row([
    span(ic(estado === "ok" ? "circle-check" : estado === "bloq" ? "lock" : "circle-play", 18), "", `color:var(${estado === "ok" ? "--estado-exito" : actual ? "--accion-primaria" : "--texto-terciario"})`),
    txt(t, `t-s${actual ? " t-sm" : ""}`, `flex:1;${actual ? "color:var(--cian-800)" : ""}`), txt(dur, "t-c c-ter"),
  ], `gap:10px;padding:10px 12px;border-radius:8px;${actual ? "background:var(--fondo-marca-suave)" : ""}`);
  const modulo = (n, t, sub, abierto, hijos = []) => col([row([div("", txt(n, "t-sm", "color:var(--cian-800)"), "width:28px;height:28px;border-radius:8px;background:var(--fondo-marca-suave);display:flex;align-items:center;justify-content:center"), col([txt(t, "t-sm"), txt(sub, "t-c c-ter")], "", "grow"), span(ic(abierto ? "chevron-up" : "chevron-down", 18), "c-ter")], "gap:12px;padding:12px 4px"), ...(abierto ? [col(hijos, "gap:2px;padding-bottom:8px")] : [])], "border-bottom:1px solid var(--borde-default)");
  const material = (i, t, sub, acc, col_) => row([chipIc(i, { color: col_ ? `var(${col_})` : "", fondo: "" }), col([txt(t, "t-sm"), txt(sub, "t-c c-ter")], "gap:2px", "grow"), btn(acc[0], { tipo: "contorno", t: "s", icono: acc[1] })], "gap:14px;padding:14px 0;border-top:1px solid var(--borde-default)");
  return E("Mis cursos", [
    cabeceraPortal(["Mis cursos", "React y Next.js", "Aula virtual"], CURSOS.react.t, "", [row([barra(68, { ancho: 140 }), txt("68%", "t-sm")], "gap:10px;padding:0 12px;height:40px;border:1px solid var(--borde-default);border-radius:8px;background:#fff"), btn("Consultar al instructor", { tipo: "contorno", icono: "message-circle" })]),
    row([
      col([
        div("", [
          div("", ic("circle-play", 40), "width:88px;height:88px;border-radius:999px;background:rgba(255,255,255,0.14);color:#fff;display:flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,0.3)"),
          row([span(ic("play", 16), "", "color:#fff"), div("grow", div("", "", "width:28%;height:100%;background:var(--cian-400);border-radius:999px"), "height:4px;border-radius:999px;background:rgba(255,255,255,0.25)"), txt("12:40 / 45:00", "t-c", "color:#fff"), span(ic("volume-2", 16), "", "color:#fff"), span(ic("maximize", 16), "", "color:#fff")], "gap:12px;position:absolute;left:20px;right:20px;bottom:16px"),
        ], "height:404px;border-radius:16px;background:radial-gradient(circle at 30% 30%,#155E75,#09090B 70%);display:flex;align-items:center;justify-content:center;position:relative"),
        col([row([badge("Módulo 2 · Clase 5", "cian"), txt("60 min · Publicado el 24 set", "t-c c-ter")], "gap:10px"), txt("Hooks: useState y useEffect", "t-h3")], "gap:8px"),
        tabs(["Descripción", ["Materiales", 3], "Anuncios"], "Materiales"),
        col([
          material("file-text", "Guía de hooks en React.pdf", "PDF · 2.4 MB", ["Descargar", "download"], "--rojo-600"),
          material("link", "Documentación oficial: react.dev/reference", "Enlace externo", ["Abrir", "external-link"]),
          material("video", "Grabación de la clase en vivo (24 set)", "Video · 1 h 52 min", ["Ver", "circle-play"], "--violeta-600"),
        ]),
        row([btn("Clase anterior", { tipo: "contorno", icono: "arrow-left" }), btn("Marcar como completada", { tipo: "suave", icono: "check" }), btn("Siguiente: Formularios", { iconoDer: "arrow-right" })], "gap:12px;margin-top:4px", "between"),
      ], "gap:20px", "grow"),
      card([
        col([txt("Contenido del curso", "t-h4"), row([barra(68, { s: true, ancho: 220 }), txt("12/18", "t-c c-ter")], "gap:10px")], "gap:8px"),
        col([
          modulo("1", "Introducción y entorno de trabajo", "6 de 6 clases · 12 h", false),
          modulo("2", "Fundamentos y práctica guiada", "5 de 8 clases · 24 h", true, [leccion("ok", "Clase 1 · JSX y renderizado", "45 min"), leccion("ok", "Clase 2 · Estado local", "60 min"), leccion("ok", "Clase 3 · Eventos", "50 min"), leccion("ok", "Clase 4 · Componentes y props", "55 min"), leccion("play", "Clase 5 · Hooks: useState y useEffect", "60 min", true), leccion("play", "Clase 6 · Formularios", "60 min"), leccion("play", "Evaluación del módulo 2", "20 min")]),
          modulo("3", "Proyecto final", "0 de 4 clases · 12 h", false),
        ]),
      ], "width:360px;gap:12px", "nosh"),
    ], "gap:24px", "top"),
  ]);
};

const evaluaciones = () => {
  const ev = (t, c) => col([txt(t, "t-sm"), txt(c, "t-c c-ter")], "gap:2px");
  return E("Evaluaciones", [
    cabeceraPortal(["Estudiante", "Evaluaciones"], "Evaluaciones", "Evaluaciones de opción múltiple con calificación automática."),
    row([kpi({ label: "Pendientes", valor: "1", icono: "hourglass", color: "var(--ambar-700)", fondo: "var(--ambar-50)", nota: "Vence el 3 de octubre" }), kpi({ label: "Aprobadas", valor: "3", icono: "circle-check", color: "var(--verde-700)", fondo: "var(--verde-50)", nota: "de 4 rendidas" }), kpi({ label: "Promedio", valor: "16.5", icono: "graduation-cap", nota: "Nota mínima aprobatoria: 13" })], "gap:16px", "stretch"),
    tabs([["Todas", 5], ["Pendientes", 1], ["Completadas", 4]], "Todas"),
    card(tabla([["Evaluación", "grow"], ["Preguntas", 90], ["Tiempo", 80], ["Intentos", 90], ["Mejor nota", 100], ["Estado", 130], ["", 130, "right"]], [
      [ev("Módulo 2: Fundamentos de React", CURSOS.react.t), "10", "20 min", "0 de 2", span("—", "c-ter"), badge("Pendiente", "adv", true), btn("Comenzar", { t: "s", iconoDer: "arrow-right" })],
      [ev("Módulo 1: Entorno y componentes", CURSOS.react.t), "8", "15 min", "1 de 2", txt("17/20", "t-sm"), badge("Aprobada", "exito", true), btn("Ver resultado", { tipo: "fantasma", t: "s" })],
      [ev("Funciones y tablas dinámicas", CURSOS.excel.t), "12", "Libre", "1 de 3", txt("11/20", "t-sm c-peligro"), badge("Desaprobada", "peligro", true), btn("Reintentar", { tipo: "contorno", t: "s", icono: "rotate-ccw" })],
      [ev("Evaluación final", CURSOS.python.t), "20", "40 min", "1 de 1", txt("18/20", "t-sm"), badge("Aprobada", "exito", true), btn("Ver resultado", { tipo: "fantasma", t: "s" })],
      [ev("Módulo 2: Estructuras de control", CURSOS.python.t), "10", "20 min", "2 de 2", txt("16/20", "t-sm"), badge("Aprobada", "exito", true), btn("Ver resultado", { tipo: "fantasma", t: "s" })],
    ]), "", "p0"),
    alerta("info", "info", "¿Cómo se califica?", "Las respuestas se corrigen al instante. Se conserva tu mejor nota entre todos los intentos permitidos."),
  ]);
};

const rendir = () => {
  const opcion = (l, t, on) => row([radio(on), div("", txt(l, "t-sm", on ? "color:#fff" : ""), `width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:var(${on ? "--accion-primaria" : "--fondo-sutil"})`), txt(t, on ? "t-bm" : "t-b", "flex:1")], `gap:14px;padding:16px 18px;border-radius:12px;border:${on ? "2px solid var(--accion-primaria)" : "1px solid var(--borde-default)"};background:var(${on ? "--fondo-marca-suave" : "--fondo-superficie"})`);
  const num = (n) => { const est = n < 3 ? "r" : n === 3 ? "a" : n === 6 ? "m" : "p"; const s = { r: "background:var(--accion-primaria);color:#fff", a: "border:2px solid var(--accion-primaria);color:var(--cian-800);background:var(--fondo-marca-suave)", m: "background:var(--ambar-100);color:var(--ambar-700)", p: "border:1px solid var(--borde-default);color:var(--texto-secundario)" }[est]; return div("", txt(String(n), "t-sm"), `width:44px;height:44px;border-radius:10px;display:flex;align-items:center;justify-content:center;${s}`); };
  const leyenda = (c, t) => row([div("", "", `width:12px;height:12px;border-radius:4px;${c}`), txt(t, "t-c c-sec")], "gap:8px");
  return [
    row([row([btn("Salir", { tipo: "fantasma", icono: "arrow-left" }), div("", "", "width:1px;height:28px;background:var(--borde-default)"), logo()], "gap:16px"), col([txt("Módulo 2: Fundamentos de React", "t-sm"), txt(CURSOS.react.t, "t-c c-ter")], "", "acentro"), row([row([span(ic("timer", 18), "c-adv"), txt("12:45", "t-bm c-adv"), txt("restantes", "t-c c-adv")], "gap:6px;height:40px;padding:0 14px;border-radius:8px;background:var(--ambar-50);border:1px solid var(--ambar-100)"), btn("Enviar evaluación", { icono: "send" })], "gap:12px")], "height:72px;padding:0 48px;background:#fff;border-bottom:1px solid var(--borde-default)", "between"),
    col([
      row([txt("Pregunta 3 de 10", "t-sm"), txt("2 respondidas · 1 marcada para revisar", "t-c c-ter")], "", "between"),
      barra(30),
      row([
        card([
          row([badge("Pregunta 3", "cian"), txt("2 puntos", "t-c c-ter")], "gap:10px"),
          txt("¿Qué hook usarías para ejecutar código después de que el componente se renderiza, por ejemplo para cargar datos desde una API?", "t-h3"),
          div("", `<pre class="mono" style="margin:0;color:var(--cian-200);line-height:22px">function Cursos() {\n  const [cursos, setCursos] = useState([]);\n  ______(() => {\n    fetch("/api/cursos").then(r => r.json()).then(setCursos);\n  }, []);\n}</pre>`, "padding:20px;border-radius:12px;background:var(--grafito-900)"),
          col([opcion("A", "useState", false), opcion("B", "useEffect", true), opcion("C", "useMemo", false), opcion("D", "useRef", false)], "gap:10px"),
          row([btn("Anterior", { tipo: "contorno", icono: "arrow-left" }), row([btn("Marcar para revisar", { tipo: "fantasma", icono: "flag" }), btn("Siguiente", { iconoDer: "arrow-right" })], "gap:8px")], "margin-top:8px", "between"),
        ], "padding:32px;gap:24px", "grow"),
        col([
          card([txt("Navegación", "t-h4"), row(Array.from({ length: 10 }, (_, i) => num(i + 1)), "gap:8px;width:252px", "wrap"), div("divisor", ""), col([leyenda("background:var(--accion-primaria)", "Respondida"), leyenda("border:2px solid var(--accion-primaria)", "Actual"), leyenda("background:var(--ambar-100)", "Marcada para revisar"), leyenda("border:1px solid var(--borde-fuerte)", "Sin responder")], "gap:8px")]),
          card([row([txt("Intento", "t-s c-sec"), txt("1 de 2", "t-sm")], "", "between"), row([txt("Nota mínima", "t-s c-sec"), txt("13 / 20", "t-sm")], "", "between"), row([txt("Puntaje total", "t-s c-sec"), txt("20 puntos", "t-sm")], "", "between")], "gap:10px"),
          alerta("exito", "cloud-check", "", "Tus respuestas se guardan automáticamente."),
        ], "gap:16px;width:300px", "nosh"),
      ], "gap:24px", "top"),
    ], "padding:32px 48px;gap:16px;flex:1"),
  ];
};

const miniCert = (nombre, curso, fondoBorde = "var(--cian-200)") => col([logo(), txt("Certificado de aprobación", "t-o c-cian"), txt(nombre, "t-h4 centro-t"), txt(curso, "t-sm c-sec centro-t")], `gap:8px;padding:24px;border:2px solid ${fondoBorde};border-radius:10px;background:linear-gradient(180deg,#fff,var(--cian-50));align-items:center`);
const certificados = () => {
  const cert = (c, cod, fecha, nota) => card([miniCert("María Fernanda Quispe Huamán", c.t), col([row([txt(c.t, "t-sm"), badge("Verificado", "exito", true)], "", "between"), txt(`${fecha} · ${c.h} horas · Nota ${nota}`, "t-c c-ter"), txt(cod, "mono c-sec")], "gap:4px"), row([btn("Descargar PDF", { tipo: "suave", t: "s", icono: "download" }), btn("Compartir", { tipo: "fantasma", t: "s", icono: "share-2" }), div("grow", ""), btnIcono("qr-code", { s: true })], "gap:8px")], "width:348px;padding:16px;gap:14px");
  return E("Certificados", [
    cabeceraPortal(["Estudiante", "Certificados"], "Mis certificados", "Se emiten al completar el 100 % del curso y aprobar las evaluaciones."),
    row([cert(CURSOS.python, "PED-2026-7Q4K9X2M", "15 ago 2026", "18/20"), cert(CURSOS.soporte, "PED-2026-3HN8Z1QA", "22 mar 2026", "17/20"),
      card([div("", [ic("lock", 32), txt("En progreso", "t-sm")], "height:196px;border-radius:10px;border:2px dashed var(--borde-fuerte);background:var(--fondo-pagina);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:var(--texto-terciario)"), col([txt(CURSOS.react.t, "t-sm"), txt("Te faltan 6 clases y 2 evaluaciones", "t-c c-ter")], "gap:4px"), row([barra(68, { ancho: 240 }), txt("68%", "t-sm")], "gap:10px"), btn("Continuar curso", { tipo: "contorno", t: "s", icono: "circle-play" })], "width:348px;padding:16px;gap:14px")], "gap:24px", "top wrap"),
    alerta("info", "shield-check", "Tus certificados son verificables", "Cualquier empresa puede validar su autenticidad en pedsar.pe/verificar con el código o escaneando el QR."),
  ]);
};

const verCertificado = () => E("Certificados", [
  cabeceraPortal(["Certificados", "PED-2026-7Q4K9X2M"], "Certificado · Python desde cero", "Emitido el 15 de agosto de 2026", [btn("Volver", { tipo: "fantasma", icono: "arrow-left" })]),
  row([
    div("", col([
      row([logo(), col([txt("Código de verificación", "t-c c-ter", "text-align:right"), txt("PED-2026-7Q4K9X2M", "mono", "font-weight:600")], "gap:2px", "base")], "", "between"),
      col([txt("Certificado de aprobación", "t-o c-cian"), txt("Se otorga el presente certificado a", "t-s c-ter"), txt("María Fernanda Quispe Huamán", "t-h1 centro-t", "font-size:36px;line-height:44px"), txt("por haber aprobado satisfactoriamente el curso", "t-s c-ter"), txt("Python desde cero", "t-h2 c-cian"), txt("con una duración de 40 horas académicas y nota final de 18/20", "t-s c-sec")], "gap:10px;padding:16px 0", "acentro"),
      row([col([div("", "", "width:180px;height:1px;background:var(--grafito-400)"), txt("Luis Ramos", "t-sm"), txt("Instructor", "t-c c-ter")], "gap:6px", "acentro"), col([div("", ic("badge-check", 40), "width:72px;height:72px;border-radius:999px;background:var(--degradado-marca);color:#fff;display:flex;align-items:center;justify-content:center"), txt("Ica, 15 ago 2026", "t-c c-ter")], "gap:6px", "acentro"), col([div("", "", "width:180px;height:1px;background:var(--grafito-400)"), txt("Gerencia General", "t-sm"), txt("PEDSAR E.I.R.L.", "t-c c-ter")], "gap:6px", "acentro")], "", "between base"),
    ], "gap:24px;padding:48px;border:2px solid var(--cian-200);border-radius:8px;height:100%;background:linear-gradient(180deg,#fff,var(--cian-50))"), "padding:16px;border-radius:16px;background:#fff;border:1px solid var(--borde-default);box-shadow:var(--sombra-lg);flex:1 1 0"),
    col([
      card([txt("Acciones", "t-h4"), btn("Descargar PDF", { icono: "download", block: true }), btn("Imprimir", { tipo: "contorno", icono: "printer", block: true }), btn("Compartir en LinkedIn", { tipo: "contorno", icono: "share-2", block: true }), btn("Copiar enlace de verificación", { tipo: "fantasma", icono: "copy", block: true })], "gap:10px"),
      card([txt("Detalles", "t-h4"), col([kv("Curso", "Python desde cero"), kv("Duración", "40 horas"), kv("Nota final", "18 / 20"), kv("Asistencia", "100%"), kv("Emisión", "15/08/2026")])], "gap:8px"),
      card([row([div("", ic("qr-code", 64), "width:88px;height:88px;border-radius:10px;background:var(--fondo-sutil);display:flex;align-items:center;justify-content:center"), txt("Escanea el QR para verificar el certificado en línea.", "t-s c-sec", "flex:1")], "gap:14px")]),
    ], "gap:16px;width:320px", "nosh"),
  ], "gap:24px", "stretch"),
]);

const pagos = () => E("Pagos y comprobantes", [
  cabeceraPortal(["Cuenta", "Pagos y comprobantes"], "Pagos y comprobantes", "Historial de pagos y comprobantes electrónicos emitidos."),
  row([kpi({ label: "Total pagado", valor: "S/ 438.00", icono: "wallet", nota: "En 2 cursos" }), kpi({ label: "Comprobantes emitidos", valor: "2", icono: "receipt", color: "var(--verde-700)", fondo: "var(--verde-50)", nota: "Boletas electrónicas SUNAT" }), kpi({ label: "Pendiente de validación", valor: "S/ 260.00", icono: "hourglass", color: "var(--ambar-700)", fondo: "var(--ambar-50)", nota: "Plin · enviado el 28 set" })], "gap:16px", "stretch"),
  card([row([txt("Historial de pagos", "t-h4"), row([btn("Todos los años", { tipo: "contorno", t: "s", iconoDer: "chevron-down" }), btn("Exportar", { tipo: "fantasma", t: "s", icono: "download" })], "gap:8px")], "padding:20px 20px 12px", "between"),
    tabla([["Fecha", 110], ["Curso", "grow"], ["Método", 150], ["Monto", 110, "right"], ["Estado", 190], ["Comprobante", 190]], [
      [txt("29/09/2026", "t-s"), txt(CURSOS.react.t, "t-sm"), row([div("", "Y", "width:24px;height:24px;border-radius:6px;background:#742284;color:#fff;font-size:12px;font-weight:600;display:flex;align-items:center;justify-content:center"), txt("Yape", "t-s")], "gap:8px"), txt("S/ 288.00", "t-sm"), badge("Aprobado", "exito", true), row([txt("B001-000482", "mono"), btnIcono("download", { s: true, sinBorde: true })], "gap:4px")],
      [txt("28/09/2026", "t-s"), txt(CURSOS.ciber.t, "t-sm"), row([div("", "P", "width:24px;height:24px;border-radius:6px;background:#00A7B8;color:#fff;font-size:12px;font-weight:600;display:flex;align-items:center;justify-content:center"), txt("Plin", "t-s")], "gap:8px"), txt("S/ 260.00", "t-sm"), badge("Pendiente de validación", "adv", true), txt("En emisión", "t-s c-ter")],
      [txt("02/07/2026", "t-s"), col([txt(CURSOS.python.t, "t-sm"), txt("Cupón BIENVENIDA10 · −S/ 30.00", "t-c c-exito")], "gap:2px"), row([span(ic("credit-card", 18), "c-sec"), txt("Tarjeta · Culqi", "t-s")], "gap:8px"), txt("S/ 150.00", "t-sm"), badge("Aprobado", "exito", true), row([txt("B001-000311", "mono"), btnIcono("download", { s: true, sinBorde: true })], "gap:4px")],
    ])], "", "p0"),
  card([row([col([txt("Solicitudes de reembolso", "t-h4"), txt("Puedes solicitar un reembolso hasta 7 días antes del inicio del curso.", "t-s c-sec")], "gap:4px"), btn("Solicitar reembolso", { tipo: "contorno", icono: "rotate-ccw" })], "", "between"), div("vacio", [chipIc("receipt", { t: 48, color: "var(--texto-terciario)", fondo: "var(--fondo-sutil)" }), txt("No tienes solicitudes de reembolso", "t-sm"), txt("Cuando solicites uno, verás aquí su estado y el motivo.", "t-s c-ter")], "padding:24px;border:1px dashed var(--borde-fuerte);border-radius:12px")]),
]);

const pantallas = [
  { grupo: "Portal del estudiante", archivo: "estudiante-inicio", titulo: "Estudiante · Inicio", render: inicio },
  { grupo: "Portal del estudiante", archivo: "estudiante-mis-cursos", titulo: "Estudiante · Mis cursos", render: misCursos },
  { grupo: "Portal del estudiante", archivo: "estudiante-aula-virtual", titulo: "Estudiante · Aula virtual", render: aula },
  { grupo: "Portal del estudiante", archivo: "estudiante-evaluaciones", titulo: "Estudiante · Evaluaciones", render: evaluaciones },
  { grupo: "Portal del estudiante", archivo: "estudiante-rendir-evaluacion", titulo: "Estudiante · Rendir evaluación", render: rendir },
  { grupo: "Portal del estudiante", archivo: "estudiante-certificados", titulo: "Estudiante · Certificados", render: certificados },
  { grupo: "Portal del estudiante", archivo: "estudiante-ver-certificado", titulo: "Estudiante · Ver certificado", render: verCertificado },
  { grupo: "Portal del estudiante", archivo: "estudiante-pagos", titulo: "Estudiante · Pagos y comprobantes", render: pagos },
];

export default pantallas;
