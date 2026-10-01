import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon, EyeIcon, HandshakeIcon, LightbulbIcon, NetworkIcon, ServerCogIcon, TargetIcon, UsersIcon } from "lucide-react";
import { IconoTono } from "@/components/comunes";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "Nosotros" };

const SERVICIOS = [
  { icono: LightbulbIcon, tono: "indigo" as const, t: "Capacitación en tecnología", d: "Programación, ofimática, datos, redes y transformación digital." },
  { icono: ServerCogIcon, tono: "coral" as const, t: "Consultoría en sistemas", d: "Diagnóstico y mejora de infraestructuras tecnológicas." },
  { icono: NetworkIcon, tono: "turquesa" as const, t: "Redes y soporte", d: "Administración de redes, mantenimiento y servicios múltiples." },
];

const VALORES = [
  { icono: TargetIcon, t: "Práctica", d: "Cada sesión incluye ejercicios aplicables al trabajo." },
  { icono: HandshakeIcon, t: "Cercanía", d: "Instructores que acompañan y responden a tiempo." },
  { icono: UsersIcon, t: "Accesibilidad", d: "Clases presenciales, virtuales y semipresenciales." },
];

// HU-48 · Nosotros
export default function NosotrosPage() {
  return (
    <>
      <section className="fondo-marca relative overflow-hidden text-white">
        <div className="fondo-puntos pointer-events-none absolute inset-0 text-white/[0.06]" />
        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <p className="animar-entrada text-xs font-semibold tracking-[0.08em] text-brand-400 uppercase">Nosotros</p>
          <h1 className="animar-entrada mt-3 max-w-3xl text-4xl font-bold tracking-tight [--i:1] sm:text-5xl">
            Impulsamos el talento digital del sur del Perú
          </h1>
          <p className="animar-entrada mt-5 max-w-2xl text-lg text-zinc-300 [--i:2]">
            PEDSAR E.I.R.L. es una empresa iqueña de consultoría en sistemas informáticos, electrónica y servicios múltiples que
            acerca la capacitación tecnológica a personas y organizaciones de Ica, Ayacucho y todo el país.
          </p>
        </div>
      </section>

      <section className="escalonado mx-auto grid max-w-7xl gap-6 px-4 py-16 sm:px-6 md:grid-cols-2 lg:px-8">
        <div className="elevar rounded-2xl border bg-card p-8 shadow-xs">
          <IconoTono icono={TargetIcon} tono="indigo" />
          <h2 className="mt-5 text-xl font-bold">Misión</h2>
          <p className="mt-2 text-muted-foreground">
            Brindar capacitación y soluciones tecnológicas de calidad, prácticas y accesibles, que fortalezcan las competencias de
            las personas y la competitividad de las empresas.
          </p>
        </div>
        <div className="elevar rounded-2xl border bg-card p-8 shadow-xs">
          <IconoTono icono={EyeIcon} tono="coral" />
          <h2 className="mt-5 text-xl font-bold">Visión</h2>
          <p className="mt-2 text-muted-foreground">
            Ser el referente regional en formación tecnológica en línea, con certificaciones confiables y una experiencia de
            aprendizaje moderna para estudiantes de todo el Perú.
          </p>
        </div>
      </section>

      <section className="border-y bg-card">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold tracking-tight">Lo que hacemos</h2>
          <div className="escalonado mt-8 grid gap-6 md:grid-cols-3">
            {SERVICIOS.map((s) => (
              <div key={s.t} className="flex gap-4">
                <IconoTono icono={s.icono} tono={s.tono} />
                <div>
                  <h3 className="font-semibold">{s.t}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold tracking-tight">Nuestros valores</h2>
        <div className="escalonado mt-8 grid gap-6 md:grid-cols-3">
          {VALORES.map((v) => (
            <div key={v.t} className="group border-t-2 border-primary pt-5">
              <v.icono className="size-6 text-primary transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110" />
              <h3 className="mt-4 font-semibold">{v.t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{v.d}</p>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-wrap gap-3">
          <Link href="/cursos" className={buttonVariants({ size: "lg", className: "group" })}>
            Ver cursos <ArrowRightIcon className="transition-transform group-hover:translate-x-1" />
          </Link>
          <Link href="/contacto" className={buttonVariants({ variant: "outline", size: "lg" })}>
            Contáctanos
          </Link>
        </div>
      </section>
    </>
  );
}
