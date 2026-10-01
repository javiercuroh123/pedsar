// Sitio público (pendientes de Figma) y autenticación.
import { alerta, avatar, btn, cabeceraPublica, campo, card, check, chipIc, col, div, ic, logo, migas, pie, row, selector, span, txt } from "./lib.mjs";

const cabeceraPagina = (miga, titulo, sub) =>
  col([migas(["Inicio", miga]), txt(titulo, "t-h1", "margin-top:8px"), sub ? txt(sub, "t-bl c-sec", "max-width:760px") : ""], "padding:56px 120px 48px;gap:4px;background:var(--fondo-superficie);border-bottom:1px solid var(--borde-default)");

const nosotros = () => {
  const stat = (a, b) => col([txt(a, "t-h2", "color:var(--cian-300)"), txt(b, "t-s", "color:var(--grafito-300)")], "gap:4px;width:252px;padding:24px;border-radius:16px;background:rgba(255,255,255,0.06);border:1px solid var(--grafito-700)");
  const heroe = row([
    col([txt("Nosotros", "t-o", "color:var(--cian-400)"), txt("Transformamos organizaciones con tecnología y formación", "t-h1", "color:#fff"), txt("Consultoría en Sistemas Informáticos – Electrónica y Servicios Múltiples PEDSAR E.I.R.L. Desde Ica, llevamos consultoría informática y capacitación práctica a personas, comercios e instituciones.", "t-bl", "color:var(--grafito-300)")], "gap:20px", "grow"),
    row([stat("+1 200", "Estudiantes capacitados"), stat("24", "Cursos y talleres"), stat("7", "Áreas tecnológicas"), stat("4.9/5", "Satisfacción promedio")], "gap:16px;width:520px", "wrap"),
  ], "padding:72px 120px;gap:64px;background:var(--degradado-profundo)");
  const mv = [["sparkles", "Misión", "Brindar servicios especializados en consultoría de gestión e informática que optimicen procesos y ofrezcan soluciones personalizadas que impulsen la eficiencia y el crecimiento de nuestros clientes."], ["trending-up", "Visión", "Ser una firma de consultoría referente en gestión empresarial e informática, reconocida por transformar organizaciones con soluciones integrales e innovación tecnológica."], ["graduation-cap", "Objetivo", "Ofrecer consultoría, tecnologías de la información y cursos que agreguen valor real, con diagnósticos precisos y acompañamiento profesional continuo."]]
    .map(([i, t, d]) => card([chipIc(i, { t: 48 }), txt(t, "t-h3"), txt(d, "t-b c-sec")], "padding:32px;flex:1 1 0"));
  const valores = [["Compromiso", "Asumimos cada proyecto con responsabilidad y entrega."], ["Calidad", "Metodologías probadas y estándares profesionales."], ["Innovación", "Evolución constante frente a las tendencias del sector."], ["Responsabilidad social", "Ética, transparencia y respeto en cada relación."]]
    .map(([t, d], i) => col([txt(`0${i + 1}`, "t-c c-cian"), txt(t, "t-h4"), txt(d, "t-s c-sec")], "gap:8px;flex:1 1 0;padding-top:20px;border-top:2px solid var(--accion-primaria)"));
  const equipo = [["LR", "Luis Ramos", "Desarrollo web y bases de datos", ""], ["CT", "Carla Torres", "Ofimática y análisis de datos", "rosa"], ["JM", "Jorge Mendoza", "Redes y ciberseguridad", "violeta"], ["RV", "Rosa Vargas", "Inteligencia artificial aplicada", "ambar"]]
    .map(([i, n, d, t]) => card([avatar(i, "l", t), col([txt(n, "t-h4"), txt(d, "t-s c-sec")], "gap:2px"), row([span(ic("star", 14), "", "color:var(--ambar-500)"), txt("4.9 · 300+ estudiantes", "t-c c-ter")], "gap:6px")], "flex:1 1 0"));
  return [
    cabeceraPublica("Nosotros"), heroe,
    col([col([txt("Quiénes somos", "t-o c-cian"), txt("Lo que nos mueve", "t-h2")], "gap:8px"), row(mv, "gap:24px", "stretch")], "padding:80px 120px 40px;gap:32px"),
    col([txt("Nuestros valores", "t-h2"), row(valores, "gap:32px", "top")], "padding:40px 120px;gap:32px"),
    col([col([txt("Equipo docente", "t-o c-cian"), txt("Aprende con profesionales en actividad", "t-h2")], "gap:8px"), row(equipo, "gap:24px")], "padding:40px 120px 80px;gap:32px"),
    div("", row([col([txt("¿Listo para empezar?", "t-h2", "color:#fff"), txt("Explora el catálogo y reserva tu cupo en minutos.", "t-bl", "color:var(--grafito-300)")], "gap:8px", "grow"), btn("Ver cursos disponibles", { t: "l", iconoDer: "arrow-right" })], "padding:48px;border-radius:24px;background:var(--fondo-inverso);gap:32px"), "padding:0 120px 80px"),
    pie(),
  ];
};

const contacto = () => {
  const info = (i, t, a, b) => row([chipIc(i, { t: 44 }), col([txt(t, "t-sm"), txt(a, "t-s c-sec"), b ? txt(b, "t-c c-ter") : ""], "gap:2px", "grow")], "gap:16px;padding:20px;border-radius:14px;background:var(--fondo-superficie);border:1px solid var(--borde-default)", "top");
  const form = card([
    col([txt("Escríbenos", "t-h3"), txt("Respondemos en menos de 24 horas hábiles.", "t-s c-sec")], "gap:4px"),
    row([campo("Nombre completo", "Tu nombre", { ph: true, s: "flex:1" }), campo("Celular", "9XX XXX XXX", { ph: true, icono: "smartphone", s: "flex:1" })], "gap:16px"),
    row([campo("Correo electrónico", "tucorreo@ejemplo.com", { ph: true, icono: "mail", s: "flex:1" }), selector("Asunto", "Información de cursos", { s: "flex:1" })], "gap:16px"),
    campo("Mensaje", "Cuéntanos qué curso te interesa o qué necesitas…", { ph: true, area: true, ayuda: "0 / 500 caracteres" }),
    check("Acepto la política de privacidad (Ley N.º 29733).", false),
    row([btn("Enviar mensaje", { t: "l", iconoDer: "arrow-right" }), txt("o", "t-s c-ter"), btn("Escribir por WhatsApp", { tipo: "contorno", t: "l", icono: "message-circle" })], "gap:12px"),
  ], "padding:32px;width:760px;flex-shrink:0");
  const mapa = div("", row([span(ic("map-pin", 18), "", "color:var(--marca-acento)"), txt("PEDSAR · Ica", "t-sm")], "gap:8px;padding:8px 14px;border-radius:999px;background:#fff;box-shadow:var(--sombra-md)"), "height:220px;border-radius:16px;border:1px solid var(--borde-default);background:repeating-linear-gradient(45deg,#E0F2F1 0 24px,#D5EFEC 24px 48px);display:flex;align-items:center;justify-content:center");
  return [
    cabeceraPublica("Contacto"),
    cabeceraPagina("Contacto", "Hablemos", "¿Tienes dudas sobre un curso, una capacitación para tu empresa o un pago? Estamos para ayudarte."),
    row([form, col([info("map-pin", "Dirección", "Jr. Manuel Medina Paredes 524, Bar. José de la Torre Ugarte", "Ica – Ica – Ica"), info("phone", "Teléfono y WhatsApp", "+51 956 000 000", "Lunes a sábado"), info("mail", "Correo", "informes@pedsar.pe"), info("clock", "Horario de atención", "Lun – Vie 9:00 – 20:00 · Sáb 9:00 – 13:00", "Inscripciones en línea 24/7"), mapa], "gap:16px", "grow")], "padding:48px 120px 80px;gap:32px", "top"),
    pie(),
  ];
};

const privacidad = () => {
  const indice = ["1. Responsable del tratamiento", "2. Datos que recopilamos", "3. Finalidad", "4. Derechos ARCO", "5. Pagos y comprobantes", "6. Cookies y analítica", "7. Términos del servicio"]
    .map((t, i) => txt(t, "t-sm", `padding:8px 12px;border-radius:8px;${i === 0 ? "background:var(--fondo-marca-suave);color:var(--cian-800)" : "color:var(--texto-secundario)"}`));
  const parrafo = (h, b) => col([txt(h, "t-h3"), txt(b, "t-b c-sec")], "gap:10px");
  return [
    cabeceraPublica(),
    cabeceraPagina("Privacidad", "Política de privacidad y términos", "Última actualización: 1 de septiembre de 2026"),
    row([
      col([txt("En esta página", "t-o c-ter", "padding:4px 12px 8px"), ...indice], "gap:4px;width:280px;padding:12px;border-radius:16px;background:#fff;border:1px solid var(--borde-default)", "nosh"),
      card([
        alerta("info", "shield-check", "", "Protegemos tus datos personales conforme a la Ley N.º 29733 y su reglamento. Puedes ejercer tus derechos ARCO escribiendo a privacidad@pedsar.pe."),
        parrafo("1. Responsable del tratamiento", "PEDSAR E.I.R.L., con RUC 20605615521 y domicilio en Jr. Manuel Medina Paredes 524, Ica, es responsable del banco de datos de estudiantes, instructores y clientes."),
        parrafo("2. Datos que recopilamos", "Nombres, apellidos, DNI, correo, celular, historial académico, asistencia, calificaciones y datos de facturación. No almacenamos los números completos de tarjeta: los procesa la pasarela de pagos."),
        parrafo("3. Finalidad", "Gestionar tu inscripción, dictar el curso, emitir comprobantes y certificados, y comunicarte información académica. Solo con tu consentimiento te enviaremos novedades comerciales."),
        parrafo("4. Derechos ARCO", "Puedes acceder, rectificar, cancelar u oponerte al tratamiento de tus datos. Desde «Mi perfil» puedes descargar una copia de tus datos en cualquier momento."),
        parrafo("5. Pagos y comprobantes", "Los pagos se procesan mediante Culqi, Izipay o Niubiz, y las billeteras Yape y Plin. Emitimos boleta o factura electrónica válida ante la SUNAT."),
      ], "padding:40px;gap:32px", "grow plano"),
    ], "padding:48px 120px 80px;gap:48px", "top"),
    pie(),
  ];
};

const e404 = () => [
  cabeceraPublica(),
  col([
    div("chip-ic", ic("search", 44), "width:96px;height:96px;border-radius:24px"),
    txt("Error 404", "t-o c-cian"), txt("No encontramos esta página", "t-h1 centro-t"),
    txt("Puede que el enlace esté roto o que el curso ya no esté disponible.", "t-bl c-sec centro-t"),
    row([btn("Ir al inicio", { t: "l", icono: "house" }), btn("Ver catálogo", { tipo: "contorno", t: "l", icono: "book-open" })], "gap:12px;margin-top:8px"),
  ], "padding:120px;gap:16px;flex:1", "acentro jcentro"),
  pie(),
];

// ---------- Autenticación ----------
const panelMarca = (titulo, sub) =>
  col([
    logo(true),
    col([
      txt(titulo, "t-h1", "color:#fff;max-width:480px"), txt(sub, "t-bl", "color:var(--grafito-300);max-width:460px"),
      col([["badge-check", "Certificados con código verificable"], ["wallet", "Paga con Yape, Plin o tarjeta"], ["clock", "Accede a tus clases 24/7"]].map(([i, t]) => row([div("", ic(i, 18), "width:36px;height:36px;border-radius:10px;background:rgba(255,255,255,0.08);color:var(--cian-300);display:flex;align-items:center;justify-content:center"), txt(t, "t-bm", "color:var(--grafito-100)")], "gap:12px")), "gap:14px;padding-top:12px"),
    ], "gap:20px"),
    col([txt("“Me inscribí desde el celular un domingo en la noche y el lunes ya tenía acceso a mis clases. El certificado lo validaron en mi trabajo con el QR.”", "t-b", "color:var(--grafito-100)"), row([avatar("KS", "m", "rosa"), col([txt("Kevin Saravia", "t-sm", "color:#fff"), txt("Egresado · Excel empresarial y Power BI", "t-c", "color:var(--grafito-400)")])], "gap:12px")], "gap:16px;padding:24px;border-radius:16px;background:rgba(255,255,255,0.06);border:1px solid var(--grafito-700)"),
  ], "width:600px;padding:56px;background:linear-gradient(135deg,var(--cian-700),var(--grafito-950));flex-shrink:0", "between");

const auth = (titulo, sub, formulario) => row([panelMarca(titulo, sub), col(col(formulario, "gap:24px;width:420px"), "flex:1;padding:48px 80px;background:var(--fondo-superficie)", "acentro jcentro")], "flex:1;min-height:960px", "stretch");
const titulo = (t, s) => col([txt(t, "t-h2"), txt(s, "t-b c-sec")], "gap:8px");
const separador = () => row([div("grow", "", "height:1px;background:var(--borde-default)"), txt("o", "t-c c-ter"), div("grow", "", "height:1px;background:var(--borde-default)")], "gap:12px");
const enlace = (a, b) => row([txt(a, "t-s c-sec"), txt(b, "t-sm c-enl")], "gap:6px", "jcentro");
const requisito = (t, ok) => row([span(ic(ok ? "circle-check" : "circle", 16), "", `color:var(${ok ? "--estado-exito" : "--texto-terciario"})`), txt(t, `t-s ${ok ? "" : "c-ter"}`)], "gap:8px");

const login = () => auth("Tu aula virtual te espera", "Continúa tus cursos, revisa tus notas y descarga tus certificados.", [
  titulo("Iniciar sesión", "Ingresa con tu correo y contraseña."),
  campo("Correo electrónico", "maria.q@correo.com", { icono: "mail" }),
  campo("Contraseña", "••••••••••", { icono: "lock", trail: "eye" }),
  row([check("Recordarme", true), txt("¿Olvidaste tu contraseña?", "t-sm c-enl")], "", "between"),
  btn("Iniciar sesión", { t: "l", block: true }), separador(),
  btn("Continuar con Google", { tipo: "contorno", t: "l", icono: "globe", block: true }),
  enlace("¿No tienes cuenta?", "Crear cuenta"),
]);

const registro = () => auth("Empieza a aprender hoy", "Crea tu cuenta gratis y reserva tu cupo en el curso que elijas.", [
  titulo("Crear cuenta", "Solo te tomará un minuto."),
  row([campo("Nombres", "María Fernanda", { s: "flex:1" }), campo("Apellidos", "Quispe Huamán", { s: "flex:1" })], "gap:16px"),
  row([campo("DNI", "47851236", { s: "flex:1" }), campo("Celular", "956 123 456", { s: "flex:1" })], "gap:16px"),
  campo("Correo electrónico", "maria.q@correo.com", { icono: "mail" }),
  campo("Contraseña", "••••••••••••", { icono: "lock", trail: "eye-off", estado: "foco" }),
  col([row([1, 2, 3, 4].map((i) => div("grow", "", `height:4px;border-radius:999px;background:var(${i <= 3 ? "--estado-exito" : "--grafito-200"})`)), "gap:6px"), txt("Contraseña segura", "t-c c-exito")], "gap:6px"),
  check("Acepto los términos y la política de privacidad.", true),
  btn("Crear cuenta", { t: "l", block: true }), enlace("¿Ya tienes cuenta?", "Inicia sesión"),
]);

const recuperar = () => auth("Recupera tu acceso", "Te enviaremos un enlace seguro para crear una nueva contraseña.", [
  row([span(ic("arrow-left", 16), "c-enl"), txt("Volver a iniciar sesión", "t-sm c-enl")], "gap:8px"),
  titulo("¿Olvidaste tu contraseña?", "Ingresa el correo con el que te registraste."),
  campo("Correo electrónico", "maria.q@correo.com", { icono: "mail" }),
  btn("Enviar enlace de recuperación", { t: "l", block: true }),
  alerta("exito", "circle-check", "Revisa tu bandeja de entrada", "Si el correo está registrado, recibirás el enlace en unos minutos. Revisa también la carpeta de spam."),
]);

const nuevaContrasena = () => auth("Casi listo", "Crea una contraseña nueva que no hayas usado antes.", [
  titulo("Nueva contraseña", "Para: maria.q@correo.com"),
  campo("Nueva contraseña", "••••••••••••", { icono: "lock", trail: "eye" }),
  campo("Confirmar contraseña", "••••••••", { icono: "lock", trail: "eye", estado: "error", ayuda: "Las contraseñas no coinciden." }),
  col([txt("Tu contraseña debe tener:", "t-sm"), requisito("Al menos 8 caracteres", true), requisito("Una letra mayúscula", true), requisito("Un número", true), requisito("Un símbolo (!@#$)", false)], "gap:8px;padding:16px;border-radius:12px;background:var(--fondo-pagina)"),
  btn("Guardar contraseña", { t: "l", block: true }),
]);

const pantallas = [
  { grupo: "Sitio público", archivo: "publico-nosotros", titulo: "Nosotros", render: nosotros },
  { grupo: "Sitio público", archivo: "publico-contacto", titulo: "Contacto", render: contacto },
  { grupo: "Sitio público", archivo: "publico-privacidad", titulo: "Privacidad y términos", render: privacidad },
  { grupo: "Sitio público", archivo: "publico-404", titulo: "Página no encontrada (404)", render: e404 },
  { grupo: "Autenticación", archivo: "auth-login", titulo: "Iniciar sesión", render: login },
  { grupo: "Autenticación", archivo: "auth-registro", titulo: "Crear cuenta", render: registro },
  { grupo: "Autenticación", archivo: "auth-recuperar", titulo: "Recuperar contraseña", render: recuperar },
  { grupo: "Autenticación", archivo: "auth-nueva-contrasena", titulo: "Nueva contraseña", render: nuevaContrasena },
];

export default pantallas;
