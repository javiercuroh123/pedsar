import type { Metadata } from "next";
import { Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { Analitica } from "@/components/analitica";
import { Proveedores } from "@/components/proveedores";
import { Toaster } from "@/components/ui/sonner";
import { publicEnv } from "@/lib/env";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ variable: "--font-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.NEXT_PUBLIC_SITE_URL),
  title: {
    default: "PEDSAR · Cursos y capacitaciones",
    template: "%s · PEDSAR",
  },
  description:
    "Cursos y capacitaciones en tecnología y gestión empresarial de PEDSAR E.I.R.L. Inscríbete en línea y obtén tu certificado digital.",
};

// Aplica las preferencias de accesibilidad antes de pintar (evita parpadeo).
const scriptAccesibilidad = `try{var d=document.documentElement,f=localStorage.getItem('pedsar-fuente');if(f)d.style.fontSize=f;if(localStorage.getItem('pedsar-contraste')==='1')d.classList.add('alto-contraste')}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${jakarta.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: scriptAccesibilidad }} />
      </head>
      <body className="flex min-h-full flex-col">
        <a
          href="#contenido"
          className="sr-only z-100 rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-4 focus:left-4"
        >
          Saltar al contenido
        </a>
        <Proveedores>
          {children}
          <Toaster richColors position="top-right" />
        </Proveedores>
        <Analitica />
      </body>
    </html>
  );
}
