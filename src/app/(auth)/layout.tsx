import { BadgeCheckIcon, Clock3Icon, LineChartIcon, SparklesIcon } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { BotonTema, MenuAccesibilidad } from "@/components/preferencias";

const VENTAJAS = [
  { icono: Clock3Icon, texto: "Inscripción en línea las 24 horas" },
  { icono: LineChartIcon, texto: "Progreso, asistencia y notas al día" },
  { icono: BadgeCheckIcon, texto: "Certificados con verificación pública" },
];

export default function LayoutAuth({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-screen flex-1 lg:grid-cols-2">
      <div className="flex flex-col bg-background px-6 py-6 sm:px-12">
        <div className="flex items-center justify-between">
          <Logo />
          <div className="flex gap-1">
            <MenuAccesibilidad />
            <BotonTema />
          </div>
        </div>
        <main id="contenido" className="m-auto w-full max-w-sm py-12">
          {children}
        </main>
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} PEDSAR E.I.R.L.</p>
      </div>

      <div className="fondo-marca relative hidden overflow-hidden p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="fondo-puntos pointer-events-none absolute inset-0 text-white/10" />
        <div className="relative ml-auto w-72 rotate-2 rounded-2xl bg-white/10 p-4 shadow-2xl ring-1 ring-white/20 backdrop-blur-md">
          <p className="flex items-center gap-2 text-xs font-semibold text-orange-200">
            <SparklesIcon className="size-3.5" /> Tu avance esta semana
          </p>
          <p className="mt-2 text-3xl font-bold">64 %</p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/20">
            <div className="h-full w-[64%] rounded-full bg-linear-to-r from-orange-300 to-pink-300" />
          </div>
          <p className="mt-2 text-xs text-white/70">14 de 22 lecciones completadas</p>
        </div>
        <div className="relative max-w-md">
          <p className="font-mono text-sm text-brand-200">PEDSAR · Cursos y capacitaciones</p>
          <h2 className="mt-4 text-3xl leading-tight font-bold tracking-tight">
            Tu matrícula, tus clases y tu certificado en un solo lugar.
          </h2>
          <ul className="mt-8 space-y-3 text-brand-100">
            {VENTAJAS.map((v) => (
              <li key={v.texto} className="flex items-center gap-3">
                <span className="grid size-8 place-items-center rounded-lg bg-white/15">
                  <v.icono className="size-4" />
                </span>
                {v.texto}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
