import type { Metadata } from "next";
import Link from "next/link";
import { MessagesSquareIcon } from "lucide-react";
import { EncabezadoPagina, EstadoVacio, Pildora } from "@/components/comunes";
import { SelectorUrl } from "@/components/selector-url";
import { buttonVariants } from "@/components/ui/button";
import { listarCursosDelInstructor } from "@/features/academico/consultas-instructor";
import { ESTADOS_BANDEJA, estudiantesDeBandeja, filtrarBandeja, leerFiltrosBandeja, noLeidosPorCurso } from "@/features/comunidad/bandeja";
import { listarBandejaInstructor } from "@/features/comunidad/consultas";
import { ListaConversaciones } from "@/features/comunidad/lista-conversaciones";
import { requireRol } from "@/lib/auth";

export const metadata: Metadata = { title: "Mensajes" };

// HU-19 · HU-52 · Bandeja unificada de mensajes de los estudiantes, filtrable por curso, estudiante y estado
export default async function InstructorMensajesPage({ searchParams }: PageProps<"/instructor/mensajes">) {
  const usuario = await requireRol("instructor");
  const [cursos, bandeja, params] = await Promise.all([listarCursosDelInstructor(usuario), listarBandejaInstructor(), searchParams]);
  const filtros = leerFiltrosBandeja(params, bandeja, cursos.map((c) => c.id));
  const visibles = filtrarBandeja(bandeja, filtros);
  const porCurso = noLeidosPorCurso(bandeja);
  const sinLeer = [...porCurso.values()].reduce((a, n) => a + n, 0);
  const estudiantes = estudiantesDeBandeja(bandeja, filtros.curso);
  const filtrando = Boolean(filtros.curso || filtros.estudiante || filtros.estado);

  return (
    <div className="space-y-6">
      <EncabezadoPagina eyebrow="Docencia" titulo="Mensajes" descripcion={sinLeer ? `${sinLeer} mensaje(s) sin leer` : "Consultas de los estudiantes de tus cursos."}>
        {bandeja.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {cursos.length > 1 && (
              <SelectorUrl
                param="curso"
                valor={filtros.curso ?? ""}
                etiqueta="Curso"
                reiniciar={["estudiante"]}
                opciones={[
                  { valor: "", etiqueta: "Todos los cursos" },
                  ...cursos.map((c) => ({ valor: c.id, etiqueta: porCurso.get(c.id) ? `${c.titulo} (${porCurso.get(c.id)} sin leer)` : c.titulo })),
                ]}
                className="w-full sm:w-60"
              />
            )}
            {estudiantes.length > 1 && (
              <SelectorUrl
                param="estudiante"
                valor={filtros.estudiante ?? ""}
                etiqueta="Estudiante"
                opciones={[{ valor: "", etiqueta: "Todos los estudiantes" }, ...estudiantes.map((e) => ({ valor: e.id, etiqueta: e.nombre }))]}
                className="w-full sm:w-52"
              />
            )}
            <SelectorUrl
              param="estado"
              valor={filtros.estado ?? ""}
              etiqueta="Estado"
              opciones={[{ valor: "", etiqueta: "Todos" }, ...ESTADOS_BANDEJA]}
              className="w-full sm:w-32"
            />
          </div>
        )}
      </EncabezadoPagina>

      {porCurso.size > 0 && cursos.length > 1 && (
        <nav aria-label="Mensajes sin leer por curso" className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Sin leer por curso:</span>
          {cursos
            .filter((c) => porCurso.has(c.id))
            .map((c) => (
              <Link key={c.id} href={`/instructor/mensajes?curso=${c.id}&estado=sin-leer`} className="rounded-full focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
                <Pildora color="indigo" className="hover:opacity-80">
                  {c.titulo} · {porCurso.get(c.id)}
                </Pildora>
              </Link>
            ))}
        </nav>
      )}

      {visibles.length ? (
        <ListaConversaciones items={visibles} href={(c) => `/instructor/mensajes/${c.id}`} />
      ) : filtrando ? (
        <EstadoVacio icono={MessagesSquareIcon} titulo="Sin conversaciones con estos filtros" descripcion="Prueba con otro curso, estudiante o estado.">
          <Link href="/instructor/mensajes" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Quitar filtros
          </Link>
        </EstadoVacio>
      ) : (
        <EstadoVacio icono={MessagesSquareIcon} titulo="No tienes mensajes" descripcion="Cuando un estudiante te escriba, su consulta aparecerá aquí." />
      )}
    </div>
  );
}
