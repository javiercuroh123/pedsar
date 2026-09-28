import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardCheckIcon } from "lucide-react";
import { EncabezadoPagina, EstadoVacio, PanelTabla, Pildora, tabla } from "@/components/comunes";
import { buttonVariants } from "@/components/ui/button";
import { aprobado } from "@/config/academico";
import { listarEvaluacionesEstudiante, listarMisInscripciones } from "@/features/academico/consultas";
import { requireRol } from "@/lib/auth";

export const metadata: Metadata = { title: "Evaluaciones" };

// HU-09 · Evaluaciones en línea
export default async function EvaluacionesEstudiantePage() {
  const usuario = await requireRol("estudiante");
  const inscripciones = (await listarMisInscripciones(usuario.id)).filter((i) => i.estado === "CONFIRMADA");
  const evaluaciones = await listarEvaluacionesEstudiante(inscripciones.map((i) => ({ id: i.id, cursoId: i.curso.id, titulo: i.curso.titulo })));

  return (
    <div className="space-y-6">
      <EncabezadoPagina titulo="Evaluaciones" descripcion="Evaluaciones de opción múltiple con calificación automática." eyebrow="Aprendizaje" />
      {evaluaciones.length ? (
        <PanelTabla>
          <table className={tabla.table}>
            <thead className={tabla.thead}>
              <tr>
                <th className={tabla.th}>Evaluación</th>
                <th className={tabla.th}>Curso</th>
                <th className={tabla.th}>Tiempo</th>
                <th className={tabla.th}>Intentos</th>
                <th className={tabla.th}>Mejor nota</th>
                <th className={tabla.th}>Estado</th>
                <th className={tabla.th} />
              </tr>
            </thead>
            <tbody>
              {evaluaciones.map((e) => {
                const agotada = e.intentos.length >= e.intentos_permitidos;
                const ok = e.mejor !== null && aprobado(e.mejor, e.puntaje_total);
                return (
                  <tr key={e.id} className={tabla.tr}>
                    <td className={`${tabla.td} font-medium`}>{e.titulo}</td>
                    <td className={`${tabla.td} text-muted-foreground`}>{e.curso.titulo}</td>
                    <td className={tabla.td}>{e.tiempo_limite_min ? `${e.tiempo_limite_min} min` : "Libre"}</td>
                    <td className={tabla.td}>
                      {e.intentos.length} de {e.intentos_permitidos}
                    </td>
                    <td className={`${tabla.td} font-mono`}>{e.mejor !== null ? `${e.mejor}/${e.puntaje_total}` : "—"}</td>
                    <td className={tabla.td}>
                      {e.mejor === null ? (
                        <Pildora color="ambar">Pendiente</Pildora>
                      ) : ok ? (
                        <Pildora color="verde">Aprobada</Pildora>
                      ) : (
                        <Pildora color="rojo">Desaprobada</Pildora>
                      )}
                    </td>
                    <td className={`${tabla.td} text-right`}>
                      {!agotada && !ok ? (
                        <Link href={`/estudiante/evaluaciones/${e.id}`} className={buttonVariants({ size: "sm" })}>
                          {e.intentos.length ? "Reintentar" : "Comenzar"}
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground">{ok ? "Completada" : "Sin intentos"}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </PanelTabla>
      ) : (
        <EstadoVacio icono={ClipboardCheckIcon} titulo="No tienes evaluaciones" descripcion="Las evaluaciones de tus cursos confirmados aparecerán aquí." />
      )}
    </div>
  );
}
