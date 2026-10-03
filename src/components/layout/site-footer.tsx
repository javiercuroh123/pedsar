import { MailIcon, MapPinIcon, PhoneIcon } from "lucide-react";
import Link from "next/link";
import { EMPRESA } from "@/config/empresa";
import { Logo } from "./logo";

const COLUMNAS = [
  {
    titulo: "Plataforma",
    enlaces: [
      { t: "Catálogo de cursos", h: "/cursos" },
      { t: "Verificar certificado", h: "/verificar" },
      { t: "Iniciar sesión", h: "/login" },
      { t: "Crear cuenta", h: "/registro" },
    ],
  },
  {
    titulo: "Empresa",
    enlaces: [
      { t: "Nosotros", h: "/nosotros" },
      { t: "Contacto", h: "/contacto" },
      { t: "Política de privacidad", h: "/privacidad" },
      { t: "Libro de reclamaciones", h: "/contacto?asunto=reclamo" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="relative mt-auto overflow-hidden bg-zinc-950 text-zinc-300 dark:border-t dark:border-white/10 dark:bg-[#131316]">
      <div className="pointer-events-none absolute -top-40 -left-24 size-96 rounded-full bg-brand-600/15 blur-3xl dark:bg-brand-500/20" />
      <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-2 lg:grid-cols-4 lg:px-8">
        <div className="lg:col-span-2">
          <Logo claro />
          <p className="mt-4 max-w-sm text-sm text-zinc-400">
            Cursos y capacitaciones en tecnología y programación. Inscríbete en línea, aprende a tu ritmo y certifícate.
          </p>
          <ul className="mt-5 space-y-2.5 text-sm text-zinc-300">
            <li className="flex items-start gap-2.5">
              <MapPinIcon className="mt-0.5 size-4 shrink-0 text-brand-400" />
              {EMPRESA.direccion}
            </li>
            <li className="flex items-center gap-2.5">
              <PhoneIcon className="size-4 shrink-0 text-brand-400" />
              {EMPRESA.telefono}
            </li>
            <li className="flex items-center gap-2.5">
              <MailIcon className="size-4 shrink-0 text-brand-400" />
              {EMPRESA.correo}
            </li>
          </ul>
        </div>
        {COLUMNAS.map((c) => (
          <div key={c.titulo}>
            <p className="text-xs font-semibold tracking-[0.08em] text-zinc-500 uppercase">{c.titulo}</p>
            <ul className="mt-4 space-y-2.5 text-sm">
              {c.enlaces.map((e) => (
                <li key={e.h}>
                  <Link href={e.h} className="inline-block text-zinc-300 transition-[color,transform] duration-200 hover:translate-x-0.5 hover:text-white">
                    {e.t}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="relative border-t border-zinc-800 dark:border-white/10 dark:bg-black/20">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-xs text-zinc-500 sm:px-6 lg:px-8">
          <p>
            © {new Date().getFullYear()} {EMPRESA.razonSocial} · RUC {EMPRESA.ruc} · Datos personales protegidos conforme a la Ley N.º 29733.
          </p>
          <p>Hecho en Ica, Perú</p>
        </div>
      </div>
    </footer>
  );
}
