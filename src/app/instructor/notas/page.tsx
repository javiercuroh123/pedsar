import type { Metadata } from "next";
import { GraduationCapIcon, UsersIcon } from "lucide-react";
import { AvatarIniciales, BarraProgreso, EncabezadoPagina, EstadoVacio, PanelTabla, Pildora, tabla } from "@/components/comunes";
import { SelectorUrl } from "@/components/selector-url";
import { ASISTENCIA_MINIMA, NOTA_MINIMA } from "@/config/academico";
import { calcularProgreso } from "@/features/academico/consultas";
import { elegirCurso, listarCursosDelInstructor, listarEstudiantesDelCurso } from "@/features/academico/consultas-instructor";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { hoyISO } from "@/lib/formato";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Estudiantes y notas" };

// HU-42 · Calificaciones y reporte académico por curso
export default async function InstructorNotasPage({ searchParams }: PageProps<"/instructor/notas">) {
  const usuario = await requireRol("instructor", "administrador");
  const { curso: param } = await searchParams;
  const cursos = await listarCursosDelInstructor(usuario);
  const curso = elegirCurso(cursos, param);

  if (!curso) {
    return (
      <div className="space-y-6">
        <EncabezadoPagina eyebrow="Docencia" titulo="Estudiantes y calificaciones" />
        <EstadoVacio icono={GraduationCapIcon} titulo="No tienes cursos asignados" />
      </div>
    );
  }

  const supabase = await createClient();
  const estudiantes = await listarEstudiantesDelCurso(curso.id);
  const ids = estudiantes.map((e) => e.inscripcionId);
  const [{ data: evaluaciones }, { data: intentos }, { data: asistencias }, { count: nSesiones }, progreso] = await Promise.all([
    supabase.from("evaluaciones").select("id, titulo, puntaje_total").eq("curso_id", curso.id).order("id"),
    ids.length ? supabase.from("intentos_evaluacion").select("inscripcion_id, evaluacion_id, puntaje_obtenido").in("inscripcion_id", ids) : Promise.resolve({ data: [] }),
    ids.length ? supabase.from("asistencias").select("inscripcion_id, estado").in("inscripcion_id", ids) : Promise.resolve({ data: [] }),
    supabase.from("sesiones").select("id", { head: true, count: "exact" }).eq("curso_id", curso.id).lte("fecha", hoyISO()),
    calcularProgreso(ids.map((id) => ({ inscripcionId: id, cursoId: curso.id }))),
  ]);

  const evs = (evaluaciones ?? []) as { id: number; titulo: string; puntaje_total: number }[];
  const mejor = (ins: string, ev: number) => {
    const n = ((intentos ?? []) as { inscripcion_id: string; evaluacion_id: number; puntaje_obtenido: number | null }[])
      .filter((i) => i.inscripcion_id === ins && i.evaluacion_id === ev)
      .map((i) => Number(i.puntaje_obtenido ?? 0));
    return n.length ? Math.max(...n) : null;
  };
  // Convierte cada nota a escala vigesimal para promediar evaluaciones con distinto puntaje total.
  const a20 = (nota: number, total: number) => (total ? (nota / total) * 20 : 0);
  const asistencia = (ins: string) => {
    const propias = ((asistencias ?? []) as { inscripcion_id: string; estado: string }[]).filter((a) => a.inscripcion_id === ins);
    const base = Math.max(nSesiones ?? 0, propias.length);
    if (!base) return null;
    return Math.round((propias.filter((a) => a.estado !== "AUSENTE").length / base) * 100);
  };

  return (
    <div className="space-y-6">
      <EncabezadoPagina eyebrow="Docencia" titulo="Estudiantes y calificaciones" descripcion={`Progreso, asistencia y notas por estudiante · ${curso.titulo}`}>
        <SelectorUrl param="curso" valor={curso.id} etiqueta="Curso" opciones={cursos.map((c) => ({ valor: c.id, etiqueta: c.titulo }))} className="w-60" />
      </EncabezadoPagina>

      {estudiantes.length === 0 ? (
        <EstadoVacio icono={UsersIcon} titulo="Aún no hay estudiantes confirmados en este curso" />
      ) : (
        <PanelTabla>
          <table className={tabla.table}>
            <thead className={tabla.thead}>
              <tr>
                <th className={tabla.th}>Estudiante</th>
                <th className={tabla.th}>Progreso</th>
                <th className={tabla.th}>Asistencia</th>
                {evs.map((e, i) => (
                  <th key={e.id} className={cn(tabla.th, "text-center")} title={e.titulo}>
                    Ev. {i + 1}
                  </th>
                ))}
                <th className={cn(tabla.th, "text-center")}>Promedio</th>
                <th className={tabla.th}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {estudiantes.map((s) => {
                const notas = evs.map((e) => ({ e, n: mejor(s.inscripcionId, e.id) }));
                const rendidas = notas.filter((x) => x.n !== null);
                const promedio = rendidas.length ? rendidas.reduce((a, x) => a + a20(x.n!, Number(x.e.puntaje_total)), 0) / rendidas.length : null;
                const as = asistencia(s.inscripcionId);
                const p = progreso.get(s.inscripcionId)?.porcentaje ?? 0;
                const riesgo = (promedio !== null && promedio < NOTA_MINIMA) || (as !== null && as < ASISTENCIA_MINIMA);
                return (
                  <tr key={s.inscripcionId} className={tabla.tr}>
                    <td className={tabla.td}>
                      <div className="flex items-center gap-3">
                        <AvatarIniciales nombre={s.nombre} src={s.avatar} className="size-8" />
                        <div className="min-w-0">
                          <p className="font-medium">{s.nombre}</p>
                          <p className="truncate text-xs text-muted-foreground">{s.correo}</p>
                        </div>
                      </div>
                    </td>
                    <td className={tabla.td}>
                      <div className="flex items-center gap-2">
                        <BarraProgreso valor={p} className="h-1.5 w-20" />
                        <span className="font-mono text-xs">{p}%</span>
                      </div>
                    </td>
                    <td className={cn(tabla.td, "font-mono text-xs", as !== null && as < ASISTENCIA_MINIMA && "text-rose-600 dark:text-rose-400")}>{as !== null ? `${as}%` : "—"}</td>
                    {notas.map(({ e, n }) => (
                      <td key={e.id} className={cn(tabla.td, "text-center font-mono", n === null && "text-muted-foreground")}>
                        {n !== null ? n : "—"}
                      </td>
                    ))}
                    <td className={cn(tabla.td, "text-center font-mono font-bold")}>{promedio !== null ? promedio.toFixed(1) : "—"}</td>
                    <td className={tabla.td}>{riesgo ? <Pildora color="rojo">En riesgo</Pildora> : <Pildora color="verde">Regular</Pildora>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </PanelTabla>
      )}
      <p className="text-xs text-muted-foreground">
        Promedio en escala vigesimal con la mejor nota de cada evaluación. «En riesgo»: promedio menor a {NOTA_MINIMA} o asistencia menor a {ASISTENCIA_MINIMA} %.
      </p>
    </div>
  );
}
