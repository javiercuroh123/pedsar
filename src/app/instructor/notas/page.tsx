import type { Metadata } from "next";
import { FileSpreadsheetIcon, FileTextIcon, GraduationCapIcon, UsersIcon } from "lucide-react";
import { AvatarIniciales, BarraProgreso, EncabezadoPagina, EstadoVacio, PanelTabla, Pildora, tabla, type ColorPildora } from "@/components/comunes";
import { SelectorUrl } from "@/components/selector-url";
import { buttonVariants } from "@/components/ui/button";
import { ASISTENCIA_MINIMA, formatearAsistencia, formatearNota, NOTA_MINIMA } from "@/config/academico";
import { elegirCurso, listarCursosDelInstructor } from "@/features/academico/consultas-instructor";
import { ETIQUETA_ESTADO_ACADEMICO, reporteDelCurso, type EstadoAcademico } from "@/features/academico/reporte-instructor";
import { requireRol } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Estudiantes y notas" };

const COLOR_ESTADO: Record<EstadoAcademico, ColorPildora> = { APTO: "verde", EN_RIESGO: "rojo", EN_CURSO: "gris" };

// HU-42 · Calificaciones y reporte académico por curso (exportable a Excel y PDF)
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

  const { evaluaciones: evs, estudiantes } = await reporteDelCurso(curso);
  const exportar = (formato: "xlsx" | "pdf") => `/instructor/notas/exportar?curso=${curso.id}&formato=${formato}`;

  return (
    <div className="space-y-6">
      <EncabezadoPagina eyebrow="Docencia" titulo="Estudiantes y calificaciones" descripcion={`Progreso, asistencia y notas por estudiante · ${curso.titulo}`}>
        <div className="flex flex-wrap items-end gap-2">
          <SelectorUrl param="curso" valor={curso.id} etiqueta="Curso" opciones={cursos.map((c) => ({ valor: c.id, etiqueta: c.titulo }))} className="w-60" />
          <a href={exportar("xlsx")} className={buttonVariants({ variant: "outline" })}>
            <FileSpreadsheetIcon /> Excel
          </a>
          <a href={exportar("pdf")} className={buttonVariants({ variant: "outline" })}>
            <FileTextIcon /> PDF
          </a>
        </div>
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
                  <th key={e.id} className={cn(tabla.th, "text-center")} title={`${e.titulo} (sobre ${e.puntaje_total})`}>
                    Ev. {i + 1}
                  </th>
                ))}
                <th className={cn(tabla.th, "text-center")}>Nota final</th>
                <th className={tabla.th}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {estudiantes.map((s) => (
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
                      <BarraProgreso valor={s.progreso} className="h-1.5 w-20" />
                      <span className="font-mono text-xs">{s.progreso}%</span>
                    </div>
                  </td>
                  <td className={cn(tabla.td, "font-mono text-xs", s.asistencia !== null && s.asistencia < ASISTENCIA_MINIMA && "text-red-600 dark:text-red-400")}>
                    {s.asistencia !== null ? `${formatearAsistencia(s.asistencia)}%` : "—"}
                  </td>
                  {s.notas.map((n, i) => (
                    <td key={evs[i].id} className={cn(tabla.td, "text-center font-mono", n === null && "text-muted-foreground")}>
                      {n !== null ? n : "—"}
                    </td>
                  ))}
                  <td className={cn(tabla.td, "text-center")}>
                    <span className="font-mono font-bold">{s.notaFinal !== null ? formatearNota(s.notaFinal) : "—"}</span>
                    {s.rendidas < evs.length && s.notaParcial !== null && (
                      <span className="block text-xs text-muted-foreground">parcial {formatearNota(s.notaParcial)}</span>
                    )}
                  </td>
                  <td className={tabla.td} title={s.motivos.join("\n") || undefined}>
                    <Pildora color={COLOR_ESTADO[s.estado]}>{ETIQUETA_ESTADO_ACADEMICO[s.estado]}</Pildora>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </PanelTabla>
      )}
      <p className="text-xs text-muted-foreground">
        Nota final en escala vigesimal con la mejor nota de cada evaluación; las no rendidas cuentan 0 (el «parcial» promedia solo las rendidas).
        «Apto»: cumple los requisitos del certificado (todas las evaluaciones con nota final ≥ {NOTA_MINIMA} y asistencia ≥ {ASISTENCIA_MINIMA} %).
        «En riesgo»: asistencia o promedio parcial por debajo del mínimo.
      </p>
    </div>
  );
}
