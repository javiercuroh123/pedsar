import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { BotonImprimir } from "@/components/boton-copiar";
import { listarMisInscripciones } from "@/features/academico/consultas";
import { VistaCertificado } from "@/features/certificacion/vista-certificado";
import { requireRol } from "@/lib/auth";
import { nombreCompleto } from "@/lib/formato";

export const metadata: Metadata = { title: "Certificado" };

/** Vista a tamaño completo lista para imprimir o guardar como PDF desde el navegador. */
export default async function CertificadoPage({ params }: PageProps<"/estudiante/certificados/[codigo]">) {
  const usuario = await requireRol("estudiante");
  const { codigo } = await params;
  const inscripcion = (await listarMisInscripciones(usuario.id)).find((i) => i.certificado?.codigo_unico === codigo);
  if (!inscripcion?.certificado) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Link href="/estudiante/certificados" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeftIcon className="size-4" /> Mis certificados
        </Link>
        <BotonImprimir />
      </div>
      <div className="mx-auto max-w-4xl print:fixed print:inset-0 print:z-50 print:max-w-none print:bg-white">
        <VistaCertificado
          datos={{
            estudiante: nombreCompleto(usuario),
            curso: inscripcion.curso.titulo,
            duracion_horas: inscripcion.curso.duracion_horas,
            fecha_emision: inscripcion.certificado.fecha_emision,
            codigo_unico: inscripcion.certificado.codigo_unico,
          }}
        />
      </div>
      <p className="text-center text-xs text-muted-foreground print:hidden">
        Consejo: en el diálogo de impresión elige «Guardar como PDF» y orientación horizontal.
      </p>
    </div>
  );
}
