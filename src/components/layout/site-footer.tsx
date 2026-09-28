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
    <footer className="relative mt-auto overflow-hidden bg-brand-950 text-brand-100">
      <div className="pointer-events-none absolute -top-32 -left-24 size-96 rounded-full bg-brand-600/30 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 -bottom-40 size-96 rounded-full bg-orange-500/20 blur-3xl" />
      <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-2 lg:grid-cols-4 lg:px-8">
        <div className="lg:col-span-2">
          <Logo claro />
          <p className="mt-4 max-w-sm text-sm text-brand-200/80">{EMPRESA.razonSocial} · RUC {EMPRESA.ruc}</p>
          <ul className="mt-4 space-y-2 text-sm text-brand-200/80">
            <li className="flex items-start gap-2">
              <MapPinIcon className="mt-0.5 size-4 shrink-0 text-orange-300" />
              {EMPRESA.direccion}
            </li>
            <li className="flex items-center gap-2">
              <PhoneIcon className="size-4 shrink-0 text-orange-300" />
              {EMPRESA.telefono}
            </li>
            <li className="flex items-center gap-2">
              <MailIcon className="size-4 shrink-0 text-orange-300" />
              {EMPRESA.correo}
            </li>
          </ul>
        </div>
        {COLUMNAS.map((c) => (
          <div key={c.titulo}>
            <p className="text-sm font-semibold text-white">{c.titulo}</p>
            <ul className="mt-4 space-y-2.5 text-sm">
              {c.enlaces.map((e) => (
                <li key={e.h}>
                  <Link href={e.h} className="text-brand-200/80 transition-colors hover:text-white">
                    {e.t}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="relative border-t border-white/10">
        <p className="mx-auto max-w-7xl px-4 py-5 text-xs text-brand-200/60 sm:px-6 lg:px-8">
          © {new Date().getFullYear()} PEDSAR E.I.R.L. · Datos personales protegidos conforme a la Ley N.º 29733.
        </p>
      </div>
    </footer>
  );
}
