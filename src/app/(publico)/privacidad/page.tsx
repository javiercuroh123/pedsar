import type { Metadata } from "next";
import Link from "next/link";
import { EMPRESA } from "@/config/empresa";

export const metadata: Metadata = { title: "Política de privacidad y términos" };

const SECCIONES = [
  {
    id: "responsable",
    t: "1. Responsable del tratamiento",
    p: [
      `${EMPRESA.razonSocial}, con RUC ${EMPRESA.ruc} y domicilio en ${EMPRESA.direccion}, es responsable del banco de datos personales de los usuarios de esta plataforma.`,
    ],
  },
  {
    id: "datos",
    t: "2. Datos que recopilamos",
    p: [
      "Datos de identificación y contacto (nombres, apellidos, DNI, correo y celular), datos académicos (inscripciones, asistencia, calificaciones y certificados) y datos de facturación.",
      "No almacenamos los datos de tus tarjetas: los pagos se procesan en pasarelas certificadas (Culqi, Izipay o Niubiz).",
    ],
  },
  {
    id: "finalidad",
    t: "3. Finalidad",
    p: [
      "Gestionar tu cuenta, tus inscripciones y pagos, emitir comprobantes electrónicos y certificados, enviarte recordatorios de sesiones y evaluaciones, y mejorar nuestros servicios.",
    ],
  },
  {
    id: "derechos",
    t: "4. Tus derechos (ARCO)",
    p: [
      "Puedes acceder, rectificar, cancelar u oponerte al tratamiento de tus datos. Desde Mi perfil › Privacidad puedes exportar una copia de tus datos. Para otras solicitudes, escríbenos desde la página de contacto.",
    ],
  },
  {
    id: "seguridad",
    t: "5. Seguridad",
    p: [
      "Usamos conexiones cifradas (HTTPS/TLS), contraseñas protegidas con bcrypt, control de acceso por roles y registros de auditoría. La base de datos se respalda diariamente.",
    ],
  },
  {
    id: "terminos",
    t: "6. Términos del servicio",
    p: [
      "La inscripción se confirma al aprobarse el pago. Las solicitudes de reembolso se atienden hasta 7 días antes del inicio del curso y se devuelven por el mismo medio de pago.",
      "El certificado se emite al completar el curso y aprobar las evaluaciones, y puede verificarse públicamente con su código único.",
    ],
  },
];

// HU-49 · Política de privacidad y términos (Ley N.º 29733)
export default function PrivacidadPage() {
  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:px-8">
      <nav className="hidden lg:sticky lg:top-24 lg:block lg:self-start" aria-label="Secciones">
        <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">En esta página</p>
        <ul className="mt-3 space-y-2 border-l text-sm">
          {SECCIONES.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="-ml-px block border-l-2 border-transparent pl-3 text-muted-foreground hover:border-primary hover:text-foreground">
                {s.t.replace(/^\d+\.\s/, "")}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <article>
        <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">Legal</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Política de privacidad y términos</h1>
        <p className="mt-3 text-muted-foreground">
          Tratamiento de datos personales conforme a la Ley N.º 29733 y su reglamento.
        </p>
        <div className="mt-10 space-y-10">
          {SECCIONES.map((s) => (
            <section key={s.id} id={s.id} className="scroll-mt-24">
              <h2 className="text-lg font-bold">{s.t}</h2>
              {s.p.map((p) => (
                <p key={p} className="mt-3 leading-relaxed text-muted-foreground">
                  {p}
                </p>
              ))}
            </section>
          ))}
        </div>
        <p className="mt-12 rounded-2xl bg-muted/60 p-5 text-sm text-muted-foreground">
          ¿Tienes preguntas sobre tus datos?{" "}
          <Link href="/contacto" className="font-medium text-primary hover:underline">
            Contáctanos
          </Link>
          .
        </p>
      </article>
    </div>
  );
}
