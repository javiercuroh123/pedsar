import { BadgeCheckIcon, Clock3Icon, SparklesIcon, WalletIcon } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { BotonTema, MenuAccesibilidad } from "@/components/preferencias";
import { pasarelaActiva } from "@/lib/pagos";

export default function LayoutAuth({ children }: LayoutProps<"/">) {
  const VENTAJAS = [
    { icono: BadgeCheckIcon, texto: "Certificados con código verificable" },
    { icono: WalletIcon, texto: pasarelaActiva() ? "Paga con tarjeta, Yape o Plin" : "Paga con Yape o Plin" },
    { icono: Clock3Icon, texto: "Accede a tus clases 24/7" },
  ];
  return (
    <div className="grid min-h-screen flex-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="fondo-marca relative hidden overflow-hidden p-12 text-white lg:flex lg:flex-col lg:gap-10">
        <div className="fondo-puntos pointer-events-none absolute inset-0 text-white/[0.06]" />
        <Logo claro className="animar-entrada relative" />

        <div className="relative my-auto max-w-md">
          {/* Solo en pantallas altas: en las bajas no hay espacio para la tarjeta decorativa. */}
          <div className="animar-escala mb-8 ml-auto hidden w-64 [--i:3] [@media(min-height:900px)]:block" aria-hidden>
            <div className="flotar rounded-2xl bg-white/10 p-4 shadow-2xl ring-1 ring-white/15 backdrop-blur-md">
              <p className="flex items-center gap-2 text-xs font-semibold text-brand-200">
                <SparklesIcon className="size-3.5" /> Tu avance esta semana
              </p>
              <p className="mt-2 text-3xl font-semibold">68 %</p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/15">
                <div className="animar-barra h-full w-[68%] rounded-full bg-brand-400" />
              </div>
              <p className="mt-2 text-xs text-white/70">12 de 18 clases completadas</p>
            </div>
          </div>
          <h2 className="animar-entrada text-[2.5rem] leading-[1.15] font-bold tracking-tight [--i:1]">Tu aula virtual te espera</h2>
          <p className="animar-entrada mt-4 text-lg text-zinc-300 [--i:2]">
            Tu matrícula, tus clases y tu certificado en un solo lugar.
          </p>
          <ul className="escalonado mt-8 space-y-3.5">
            {VENTAJAS.map((v) => (
              <li key={v.texto} className="flex items-center gap-3 font-medium text-zinc-100">
                <span className="grid size-9 place-items-center rounded-lg bg-white/10 text-brand-300 ring-1 ring-white/10">
                  <v.icono className="size-[18px]" />
                </span>
                {v.texto}
              </li>
            ))}
          </ul>
        </div>

        <figure className="animar-entrada relative max-w-md rounded-2xl bg-white/[0.06] p-6 ring-1 ring-white/10 [--i:4] [@media(max-height:700px)]:hidden">
          <blockquote className="text-zinc-100">
            “Me inscribí desde el celular un domingo en la noche y el lunes ya tenía acceso a mis clases. El certificado lo validaron en mi
            trabajo con el QR.”
          </blockquote>
          <figcaption className="mt-4 flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-full bg-rose-100 text-sm font-medium text-rose-700">KS</span>
            <span className="leading-tight">
              <span className="block text-sm font-medium text-white">Kevin Saravia</span>
              <span className="block text-xs text-zinc-400">Egresado · Excel empresarial y Power BI</span>
            </span>
          </figcaption>
        </figure>
      </div>

      <div className="flex flex-col bg-card px-6 py-6 sm:px-12">
        <div className="flex items-center justify-between">
          <Logo className="lg:invisible" />
          <div className="flex gap-1.5">
            <MenuAccesibilidad />
            <BotonTema />
          </div>
        </div>
        <main id="contenido" className="m-auto w-full max-w-md py-12">
          {children}
        </main>
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} PEDSAR E.I.R.L.</p>
      </div>
    </div>
  );
}
