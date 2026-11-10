import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, DownloadIcon, Share2Icon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { listarMisInscripciones } from "@/features/academico/consultas";
import { datosCertificado } from "@/features/certificacion/consultas";
import { enlacesCompartirCertificado } from "@/features/certificacion/qr";
import { VistaCertificado } from "@/features/certificacion/vista-certificado";
import { requireRol } from "@/lib/auth";
import { publicEnv } from "@/lib/env";
import { nombreCompleto } from "@/lib/formato";

export const metadata: Metadata = { title: "Certificado" };

/** Vista a tamaño completo del certificado, con descarga del PDF generado por el servidor (HU-11 · HU-37). */
export default async function CertificadoPage({ params }: PageProps<"/estudiante/certificados/[codigo]">) {
  const usuario = await requireRol("estudiante");
  const { codigo } = await params;
  const inscripcion = (await listarMisInscripciones(usuario.id)).find((i) => i.certificado?.codigo_unico === codigo);
  if (!inscripcion?.certificado) notFound();
  const datos = datosCertificado(inscripcion, nombreCompleto(usuario));
  const compartir = enlacesCompartirCertificado(
    publicEnv.NEXT_PUBLIC_SITE_URL,
    datos.codigo_unico,
    datos.curso,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/estudiante/certificados" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeftIcon className="size-4" /> Mis certificados
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <a href={compartir.linkedin} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <Share2Icon /> LinkedIn
          </a>
          <a href={compartir.whatsapp} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <Share2Icon /> WhatsApp
          </a>
          <a href={compartir.facebook} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <Share2Icon /> Facebook
          </a>
          <a href={`/certificados/${codigo}/pdf`} className={buttonVariants({ size: "sm" })}>
            <DownloadIcon /> Descargar PDF
          </a>
        </div>
      </div>
      <div className="mx-auto max-w-4xl">
        <VistaCertificado datos={datos} />
      </div>
      <p className="text-center text-xs text-muted-foreground">
        El PDF incluye un código QR que lleva a la verificación pública del certificado.
      </p>
    </div>
  );
}
