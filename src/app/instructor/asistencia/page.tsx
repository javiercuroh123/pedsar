import type { Metadata } from "next";
import { CalendarXIcon, UserCheckIcon, UsersIcon } from "lucide-react";
import { EncabezadoPagina, EstadoVacio } from "@/components/comunes";
import { SelectorUrl } from "@/components/selector-url";
import { elegirCurso, listarCursosDelInstructor, listarEstudiantesDelCurso, listarSesionesDeCursos } from "@/features/academico/consultas-instructor";
import { ListaAsistencia } from "@/features/academico/lista-asistencia";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatearDiaSemana, formatearFecha, formatearHora, hoyISO } from "@/lib/formato";
import type { EstadoAsistencia } from "@/types/dominio";

export const metadata: Metadata = { title: "Asistencia" };

// HU-58 · Registro de asistencia por sesión
export default async function InstructorAsistenciaPage({ searchParams }: PageProps<"/instructor/asistencia">) {
  const usuario = await requireRol("instructor", "administrador");
  const { curso: pCurso, sesion: pSesion } = await searchParams;
  const cursos = await listarCursosDelInstructor(usuario);
  const curso = elegirCurso(cursos, pCurso);

  const sesiones = curso ? await listarSesionesDeCursos([curso.id]) : [];
  const hoy = hoyISO();
  // Por defecto: la sesión de hoy o la última realizada.
  const porDefecto = [...sesiones].reverse().find((s) => s.fecha <= hoy) ?? sesiones[0];
  const sesion = sesiones.find((s) => String(s.id) === pSesion) ?? porDefecto;

  const [estudiantes, marcas] = curso && sesion
    ? await Promise.all([
        listarEstudiantesDelCurso(curso.id),
        (await createClient()).from("asistencias").select("inscripcion_id, estado").eq("sesion_id", sesion.id),
      ])
    : [[], { data: [] }];

  return (
    <div className="space-y-6">
      <EncabezadoPagina eyebrow="Docencia" titulo="Registro de asistencia" descripcion="Marca la asistencia de cada estudiante en la sesión.">
        {curso && (
          <SelectorUrl param="curso" valor={curso.id} etiqueta="Curso" reiniciar={["sesion"]} opciones={cursos.map((c) => ({ valor: c.id, etiqueta: c.titulo }))} className="w-56" />
        )}
        {sesion && (
          <SelectorUrl
            param="sesion"
            valor={String(sesion.id)}
            etiqueta="Sesión"
            opciones={sesiones.map((s) => ({ valor: String(s.id), etiqueta: `${formatearDiaSemana(s.fecha)} ${formatearFecha(s.fecha)} · ${formatearHora(s.hora_inicio)}` }))}
            className="w-64 capitalize"
          />
        )}
      </EncabezadoPagina>

      {!curso ? (
        <EstadoVacio icono={UserCheckIcon} titulo="No tienes cursos asignados" />
      ) : !sesion ? (
        <EstadoVacio icono={CalendarXIcon} titulo="Este curso no tiene sesiones" descripcion="Programa una sesión para poder registrar asistencia." />
      ) : estudiantes.length === 0 ? (
        <EstadoVacio icono={UsersIcon} titulo="Aún no hay estudiantes confirmados" descripcion="La lista aparecerá cuando se confirmen las inscripciones." />
      ) : (
        <ListaAsistencia
          key={sesion.id}
          sesionId={sesion.id}
          fecha={sesion.fecha}
          estudiantes={estudiantes}
          iniciales={Object.fromEntries(((marcas.data ?? []) as { inscripcion_id: string; estado: EstadoAsistencia }[]).map((m) => [m.inscripcion_id, m.estado]))}
        />
      )}
    </div>
  );
}
