import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDaysIcon, Trash2Icon, VideoIcon } from "lucide-react";
import { BotonAccion } from "@/components/boton-accion";
import { EncabezadoPagina, EstadoVacio, PanelTabla, Pildora, tabla, type ColorPildora } from "@/components/comunes";
import { buttonVariants } from "@/components/ui/button";
import { eliminarSesion } from "@/features/academico/acciones-instructor";
import { listarCursosDelInstructor, listarSesionesDeCursos } from "@/features/academico/consultas-instructor";
import { DialogoSesion } from "@/features/academico/formularios-instructor";
import { requireRol } from "@/lib/auth";
import { ETIQUETA_MODALIDAD, formatearDiaSemana, formatearFecha, formatearHora, horaFin, hoyISO } from "@/lib/formato";
import { cn } from "@/lib/utils";
import type { Modalidad } from "@/types/dominio";

export const metadata: Metadata = { title: "Sesiones" };

const COLOR: Record<Modalidad, ColorPildora> = { VIRTUAL: "indigo", PRESENCIAL: "verde", SEMIPRESENCIAL: "coral" };

// HU-16 · Horario de sesiones · HU-38 · HU-62 (Zoom / Calendar)
export default async function InstructorSesionesPage({ searchParams }: PageProps<"/instructor/sesiones">) {
  const usuario = await requireRol("instructor", "administrador");
  const { ver } = await searchParams;
  const cursos = await listarCursosDelInstructor(usuario);
  const todas = await listarSesionesDeCursos(cursos.map((c) => c.id));
  const hoy = hoyISO();
  const pasadas = ver === "pasadas";
  const sesiones = pasadas ? todas.filter((s) => s.fecha < hoy).reverse() : todas.filter((s) => s.fecha >= hoy);
  const titulo = (id: string) => cursos.find((c) => c.id === id)?.titulo ?? "";

  return (
    <div className="space-y-6">
      <EncabezadoPagina eyebrow="Docencia" titulo="Sesiones y horarios" descripcion="Programa clases presenciales, virtuales o semipresenciales.">
        {cursos.length > 0 && <DialogoSesion cursos={cursos} />}
      </EncabezadoPagina>

      <div className="inline-flex rounded-lg bg-muted p-1 text-sm">
        {[
          { v: "", t: "Próximas" },
          { v: "pasadas", t: "Realizadas" },
        ].map((o) => (
          <Link
            key={o.v}
            href={o.v ? `?ver=${o.v}` : "?"}
            className={cn("rounded-md px-3 py-1.5 font-medium", (o.v === "pasadas") === pasadas ? "bg-background shadow-sm" : "text-muted-foreground")}
          >
            {o.t}
          </Link>
        ))}
      </div>

      {sesiones.length ? (
        <PanelTabla>
          <table className={tabla.table}>
            <thead className={tabla.thead}>
              <tr>
                <th className={tabla.th}>Fecha</th>
                <th className={tabla.th}>Horario</th>
                <th className={tabla.th}>Curso</th>
                <th className={tabla.th}>Modalidad</th>
                <th className={tabla.th}>Enlace</th>
                <th className={tabla.th} />
              </tr>
            </thead>
            <tbody>
              {sesiones.map((s) => (
                <tr key={s.id} className={tabla.tr}>
                  <td className={cn(tabla.td, "font-medium whitespace-nowrap")}>
                    <span className="capitalize">{formatearDiaSemana(s.fecha)}</span> {formatearFecha(s.fecha)}
                    {s.fecha === hoy && <Pildora color="coral" className="ml-2">Hoy</Pildora>}
                  </td>
                  <td className={cn(tabla.td, "font-mono text-xs whitespace-nowrap")}>
                    {formatearHora(s.hora_inicio)} – {horaFin(s.hora_inicio, s.duracion_minutos)}
                  </td>
                  <td className={tabla.td}>{titulo(s.curso_id)}</td>
                  <td className={tabla.td}>
                    <Pildora color={COLOR[s.modalidad]}>{ETIQUETA_MODALIDAD[s.modalidad]}</Pildora>
                  </td>
                  <td className={tabla.td}>
                    {s.enlace_virtual ? (
                      <a href={s.enlace_virtual} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                        <VideoIcon className="size-3.5" /> Abrir
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className={cn(tabla.td, "text-right whitespace-nowrap")}>
                    <Link href={`/instructor/asistencia?curso=${s.curso_id}&sesion=${s.id}`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                      Asistencia
                    </Link>
                    <BotonAccion
                      accion={eliminarSesion}
                      campos={{ id: s.id }}
                      confirmar="¿Eliminar esta sesión? También se borrará su asistencia."
                      variant="ghost"
                      size="icon-sm"
                      className="text-rose-600 dark:text-rose-400"
                      aria-label="Eliminar sesión"
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
        <EstadoVacio icono={CalendarDaysIcon} titulo={pasadas ? "Aún no hay sesiones realizadas" : "No hay sesiones programadas"} descripcion="Programa la próxima clase con el botón «Nueva sesión»." />
      )}
    </div>
  );
}
