import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRightIcon, ClipboardListIcon } from "lucide-react";
import { EncabezadoPagina, EstadoVacio, Pildora } from "@/components/comunes";
import { listarEncuestasEstudiante } from "@/features/encuestas/consultas";
import { requireRol } from "@/lib/auth";
import { formatearFecha } from "@/lib/formato";

export const metadata: Metadata = { title: "Encuestas" };

// HU-43 · Encuestas de satisfacción que recibió el estudiante al terminar sus cursos
export default async function EstudianteEncuestasPage() {
  const usuario = await requireRol("estudiante");
  const encuestas = await listarEncuestasEstudiante(usuario.id);
  const pendientes = encuestas.filter((e) => !e.respondidaEn).length;

  return (
    <div className="space-y-6">
      <EncabezadoPagina
        eyebrow="Aprendizaje"
        titulo="Encuestas"
        descripcion={pendientes ? `Tienes ${pendientes} encuesta(s) por responder. Te toman unos 2 minutos.` : "Al terminar un curso te pediremos tu opinión."}
      />
      {encuestas.length ? (
        <ul className="divide-y overflow-hidden rounded-2xl border bg-card shadow-xs">
          {encuestas.map((e) => (
            <li key={e.envioId}>
              <Link href={`/estudiante/encuestas/${e.envioId}`} className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/40">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                  <ClipboardListIcon className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{e.curso}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {e.titulo} · {e.respondidaEn ? `Respondida el ${formatearFecha(e.respondidaEn)}` : `Recibida el ${formatearFecha(e.enviadaEn)}`}
                  </p>
                </div>
                {e.respondidaEn ? <Pildora color="turquesa">Respondida</Pildora> : <Pildora color="coral">Por responder</Pildora>}
                <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EstadoVacio icono={ClipboardListIcon} titulo="Aún no tienes encuestas" descripcion="Cuando termines un curso y recibas tu certificado, te pediremos tu opinión." />
      )}
    </div>
  );
}
