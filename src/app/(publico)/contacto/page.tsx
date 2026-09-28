import type { Metadata } from "next";
import { ClockIcon, MailIcon, MapPinIcon, MessageCircleIcon, PhoneIcon } from "lucide-react";
import { IconoTono, type Tono } from "@/components/comunes";
import { EMPRESA } from "@/config/empresa";
import { FormularioContacto } from "@/features/contacto/formulario-contacto";

export const metadata: Metadata = { title: "Contacto" };

// HU-48 · Contacto · HU-43 · Libro de reclamaciones
export default async function ContactoPage({ searchParams }: PageProps<"/contacto">) {
  const { asunto } = await searchParams;
  const canales: { icono: typeof MailIcon; tono: Tono; titulo: string; texto: string; href?: string }[] = [
    { icono: MessageCircleIcon, tono: "turquesa", titulo: "WhatsApp", texto: EMPRESA.telefono, href: `https://wa.me/${EMPRESA.whatsapp}` },
    { icono: MailIcon, tono: "indigo", titulo: "Correo", texto: EMPRESA.correo, href: `mailto:${EMPRESA.correo}` },
    { icono: PhoneIcon, tono: "coral", titulo: "Teléfono", texto: EMPRESA.telefono, href: `tel:${EMPRESA.telefono.replace(/\s/g, "")}` },
    { icono: MapPinIcon, tono: "rosa", titulo: "Oficina", texto: EMPRESA.direccion },
    { icono: ClockIcon, tono: "ambar", titulo: "Horario de atención", texto: EMPRESA.horario },
  ];

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-linear-to-b from-brand-50 via-orange-50/40 to-transparent dark:from-brand-950/50 dark:via-transparent" />
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">Contacto</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">¿Hablamos?</h1>
        <p className="mt-3 max-w-xl text-muted-foreground">
          Resolvemos tus dudas sobre cursos, inscripciones, pagos y capacitaciones para empresas.
        </p>
        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_minmax(0,1.4fr)]">
          <ul className="space-y-3">
            {canales.map((c) => {
              const contenido = (
                <>
                  <IconoTono icono={c.icono} tono={c.tono} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{c.titulo}</p>
                    <p className="text-sm text-muted-foreground">{c.texto}</p>
                  </div>
                </>
              );
              return (
                <li key={c.titulo}>
                  {c.href ? (
                    <a href={c.href} target={c.href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className="flex items-center gap-4 rounded-2xl border bg-card p-4 transition hover:border-brand-300 hover:shadow-md">
                      {contenido}
                    </a>
                  ) : (
                    <div className="flex items-center gap-4 rounded-2xl border bg-card p-4">{contenido}</div>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="rounded-3xl border bg-card p-6 shadow-xl shadow-brand-900/5 sm:p-8">
            <h2 className="text-lg font-bold">Escríbenos</h2>
            <p className="mb-6 text-sm text-muted-foreground">Te responderemos en menos de 24 horas hábiles.</p>
            <FormularioContacto asunto={typeof asunto === "string" ? asunto : undefined} />
          </div>
        </div>
      </div>
    </div>
  );
}
