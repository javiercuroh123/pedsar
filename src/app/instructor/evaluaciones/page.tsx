import type { Metadata } from "next";
import { ClipboardListIcon, Trash2Icon } from "lucide-react";
import { BotonAccion } from "@/components/boton-accion";
import { EncabezadoPagina, EstadoVacio, PanelTabla, PestanasEnlace, Pildora, tabla } from "@/components/comunes";
import { eliminarEvaluacion } from "@/features/academico/acciones-instructor";
import { ConstructorEvaluacion } from "@/features/academico/constructor-evaluacion";
import { listarCursosDelInstructor } from "@/features/academico/consultas-instructor";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Evaluaciones" };

// HU-09 · Evaluaciones de opción múltiple · HU-59
export default async function InstructorEvaluacionesPage({ searchParams }: PageProps<"/instructor/evaluaciones">) {
  const usuario = await requireRol("instructor", "administrador");
  const { tab } = await searchParams;
  const cursos = await listarCursosDelInstructor(usuario);
  const ids = cursos.map((c) => c.id);
  const supabase = await createClient();

  const { data } = ids.length
    ? await supabase
        .from("evaluaciones")
        .select("id, titulo, curso_id, puntaje_total, intentos_permitidos, tiempo_limite_min, preguntas(count), intentos_evaluacion(count)")
        .in("curso_id", ids)
        .order("id", { ascending: false })
    : { data: [] };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const evaluaciones = (data ?? []) as any[];
  const conteo = (x: unknown) => (Array.isArray(x) ? (x[0]?.count ?? 0) : 0);
  const nueva = tab === "nueva";

  return (
    <div className="space-y-6">
      <EncabezadoPagina eyebrow="Docencia" titulo="Evaluaciones" descripcion="Crea evaluaciones de opción múltiple con puntaje, tiempo límite e intentos." />
      <PestanasEnlace
        activa={nueva ? "nueva" : "lista"}
        items={[
          { valor: "lista", etiqueta: "Mis evaluaciones", href: "/instructor/evaluaciones" },
          { valor: "nueva", etiqueta: "Crear evaluación", href: "/instructor/evaluaciones?tab=nueva" },
        ]}
      />
      {nueva ? (
        cursos.length ? (
          <ConstructorEvaluacion cursos={cursos} />
        ) : (
          <EstadoVacio icono={ClipboardListIcon} titulo="Necesitas un curso asignado para crear evaluaciones" />
        )
      ) : evaluaciones.length ? (
        <PanelTabla>
          <table className={tabla.table}>
            <thead className={tabla.thead}>
              <tr>
                <th className={tabla.th}>Evaluación</th>
                <th className={tabla.th}>Curso</th>
                <th className={tabla.th}>Preguntas</th>
                <th className={tabla.th}>Tiempo</th>
                <th className={tabla.th}>Intentos</th>
                <th className={tabla.th}>Entregas</th>
                <th className={tabla.th} />
              </tr>
            </thead>
            <tbody>
              {evaluaciones.map((e) => (
                <tr key={e.id} className={tabla.tr}>
                  <td className={cn(tabla.td, "font-medium")}>{e.titulo}</td>
                  <td className={cn(tabla.td, "text-muted-foreground")}>{cursos.find((c) => c.id === e.curso_id)?.titulo}</td>
                  <td className={tabla.td}>
                    {conteo(e.preguntas)} · {Number(e.puntaje_total)} pts
                  </td>
                  <td className={tabla.td}>{e.tiempo_limite_min ? `${e.tiempo_limite_min} min` : "Libre"}</td>
                  <td className={tabla.td}>{e.intentos_permitidos}</td>
                  <td className={tabla.td}>
                    <Pildora color={conteo(e.intentos_evaluacion) ? "turquesa" : "gris"}>{conteo(e.intentos_evaluacion)} intentos</Pildora>
                  </td>
                  <td className={cn(tabla.td, "text-right")}>
                    <BotonAccion
                      accion={eliminarEvaluacion}
                      campos={{ id: e.id }}
                      confirmar={`¿Eliminar "${e.titulo}"? Se borrarán también los intentos de los estudiantes.`}
                      variant="ghost"
                      size="icon-sm"
                      className="text-rose-600 dark:text-rose-400"
                      aria-label="Eliminar evaluación"
                    >
                      <Trash2Icon />
                    </BotonAccion>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </PanelTabla>
      ) : (
        <EstadoVacio icono={ClipboardListIcon} titulo="Aún no creaste evaluaciones" descripcion="Usa la pestaña «Crear evaluación» para armar la primera." />
      )}
    </div>
  );
}
