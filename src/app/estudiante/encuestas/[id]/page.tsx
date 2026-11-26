import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CircleCheckBigIcon } from "lucide-react";
import { EncabezadoPagina } from "@/components/comunes";
import { buttonVariants } from "@/components/ui/button";
import { obtenerEncuestaParaResponder } from "@/features/encuestas/consultas";
import { FormularioEncuesta } from "@/features/encuestas/formulario-encuesta";
import { requireRol } from "@/lib/auth";
import { formatearFecha } from "@/lib/formato";

export const metadata: Metadata = { title: "Encuesta de satisfacción" };

// HU-43 · Responder la encuesta de satisfacción de un curso terminado
export default async function EstudianteEncuestaPage({ params }: PageProps<"/estudiante/encuestas/[id]">) {
  await requireRol("estudiante");
  const { id } = await params;
  const envioId = Number(id);
  const encuesta = Number.isInteger(envioId) && envioId > 0 ? await obtenerEncuestaParaResponder(envioId) : null;
  if (!encuesta) notFound();

  return (
    <div className="max-w-3xl space-y-6">
      <EncabezadoPagina eyebrow="Encuestas" titulo={encuesta.curso} descripcion={encuesta.descripcion ?? encuesta.titulo} />
      {encuesta.respondidaEn ? (
        <div className="flex flex-col items-center rounded-2xl border bg-card px-6 py-14 text-center shadow-xs">
          <span className="grid size-12 place-items-center rounded-xl bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-300">
            <CircleCheckBigIcon className="size-6" />
          </span>
          <p className="mt-4 text-lg font-semibold">¡Gracias por responder!</p>
          <p className="mt-1 text-sm text-muted-foreground">Enviaste tus respuestas el {formatearFecha(encuesta.respondidaEn)}. En los resultados no se muestra tu nombre.</p>
          <Link href="/estudiante/encuestas" className={buttonVariants({ variant: "outline", className: "mt-6" })}>
            Ver mis encuestas
          </Link>
        </div>
      ) : (
        <FormularioEncuesta envioId={encuesta.envioId} preguntas={encuesta.preguntas} />
      )}
    </div>
  );
}
