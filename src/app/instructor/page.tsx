import type { Metadata } from "next";
import Link from "next/link";
import { BookOpenIcon, CalendarDaysIcon, ClipboardListIcon, UploadIcon, UsersIcon, VideoIcon } from "lucide-react";
import { BarraProgreso, EncabezadoPagina, EstadoBadge, EstadoVacio, PanelTabla, TarjetaKpi, tabla } from "@/components/comunes";
import { buttonVariants } from "@/components/ui/button";
import { calcularProgreso } from "@/features/academico/consultas";
import { listarCursosDelInstructor, listarSesionesDeCursos } from "@/features/academico/consultas-instructor";
import { SiglaCurso } from "@/features/catalogo/portada-curso";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatearFecha, formatearHora, horaFin, hoyISO } from "@/lib/formato";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Inicio" };

const sumarDias = (iso: string, dias: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
};

// HU-65 · Panel del instructor · HU-54
export default async function InstructorPage() {
  const usuario = await requireRol("instructor", "administrador");
  const cursos = await listarCursosDelInstructor(usuario);
  const ids = cursos.map((c) => c.id);
  const supabase = await createClient();
  const hoy = hoyISO();

  const [sesiones, { data: inscripciones }, { count: evaluaciones }] = await Promise.all([
    listarSesionesDeCursos(ids),
    ids.length ? supabase.from("inscripciones").select("id, curso_id").in("curso_id", ids).eq("estado", "CONFIRMADA") : Promise.resolve({ data: [] }),
    ids.length
      ? supabase.from("evaluaciones").select("id", { head: true, count: "exact" }).in("curso_id", ids)
      : Promise.resolve({ count: 0 }),
  ]);
  const filas = (inscripciones ?? []) as { id: string; curso_id: string }[];
  const progreso = await calcularProgreso(filas.map((f) => ({ inscripcionId: f.id, cursoId: f.curso_id })));

  const porCurso = (id: string) => filas.filter((f) => f.curso_id === id);
  const progresoMedio = (id: string) => {
    const p = porCurso(id).map((f) => progreso.get(f.id)?.porcentaje ?? 0);
    return p.length ? Math.round(p.reduce((a, b) => a + b, 0) / p.length) : 0;
  };
  const deHoy = sesiones.filter((s) => s.fecha === hoy);
  const semana = sesiones.filter((s) => s.fecha >= hoy && s.fecha <= sumarDias(hoy, 6));
  const proxima = (id: string) => sesiones.find((s) => s.curso_id === id && s.fecha >= hoy);
  const tituloDe = (id: string) => cursos.find((c) => c.id === id)?.titulo ?? "";

  return (
    <div className="space-y-8">
      <EncabezadoPagina
        eyebrow="Docencia"
        titulo={`Hola, ${usuario.nombres.split(" ")[0] || "instructor"}`}
        descripcion={`Hoy tienes ${deHoy.length} sesión(es) programada(s).`}
      >
        <Link href="/instructor/contenidos" className={buttonVariants({ variant: "outline" })}>
          <UploadIcon /> Subir contenido
        </Link>
        <Link href="/instructor/sesiones" className={buttonVariants()}>
          <CalendarDaysIcon /> Programar sesión
        </Link>
      </EncabezadoPagina>

      <div className="escalonado grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <TarjetaKpi etiqueta="Cursos a cargo" valor={cursos.length} icono={BookOpenIcon} tono="indigo" detalle={`${cursos.filter((c) => c.estado === "PUBLICADO").length} publicados`} />
        <TarjetaKpi etiqueta="Estudiantes activos" valor={filas.length} icono={UsersIcon} tono="turquesa" detalle="Inscripciones confirmadas" />
        <TarjetaKpi etiqueta="Sesiones esta semana" valor={semana.length} icono={CalendarDaysIcon} tono="coral" detalle={semana[0] ? `Próxima: ${formatearFecha(semana[0].fecha)}` : "Sin sesiones"} />
        <TarjetaKpi etiqueta="Evaluaciones" valor={evaluaciones ?? 0} icono={ClipboardListIcon} tono="rosa" detalle="Creadas en tus cursos" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <PanelTabla
          className="lg:col-span-2"
          titulo="Mis cursos"
          accion={
            <Link href="/instructor/notas" className="text-sm font-medium text-primary hover:underline">
              Ver estudiantes
            </Link>
          }
        >
          {cursos.length ? (
            <table className={cn(tabla.table, "min-w-150")}>
              <thead className={tabla.thead}>
                <tr>
                  <th className={tabla.th}>Curso</th>
                  <th className={tabla.th}>Estudiantes</th>
                  <th className={tabla.th}>Progreso medio</th>
                  <th className={tabla.th}>Próxima sesión</th>
                </tr>
              </thead>
              <tbody>
                {cursos.map((c) => {
                  const p = progresoMedio(c.id);
                  const s = proxima(c.id);
                  return (
                    <tr key={c.id} className={tabla.tr}>
                      <td className={tabla.td}>
                        <div className="flex items-center gap-3">
                          <SiglaCurso titulo={c.titulo} categoria={c.categoria?.slug} className="size-9 text-xs" />
                          <div>
                            <p className="font-medium">{c.titulo}</p>
                            {c.estado !== "PUBLICADO" && <EstadoBadge estado={c.estado} />}
                          </div>
                        </div>
                      </td>
                      <td className={`${tabla.td} tabular-nums`}>
                        {porCurso(c.id).length}/{c.cupo_maximo}
                      </td>
                      <td className={tabla.td}>
                        <div className="flex items-center gap-2">
                          <BarraProgreso valor={p} className="h-1.5 w-24" tono="turquesa" />
                          <span className="font-mono text-xs">{p} %</span>
                        </div>
                      </td>
                      <td className={`${tabla.td} text-muted-foreground`}>{s ? `${formatearFecha(s.fecha)} · ${formatearHora(s.hora_inicio)}` : "Sin programar"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">Aún no tienes cursos asignados. El administrador te los asignará.</p>
          )}
        </PanelTabla>

        <section className="overflow-hidden rounded-2xl border bg-card shadow-xs">
          <div className="border-b bg-red-50/60 px-5 py-4 dark:bg-red-500/10">
            <h2 className="font-semibold">Agenda de hoy</h2>
            <p className="text-xs text-muted-foreground">{formatearFecha(hoy)}</p>
          </div>
          {deHoy.length ? (
            <ul className="divide-y">
              {deHoy.map((s) => (
                <li key={s.id} className="px-5 py-4">
                  <p className="font-mono text-xs text-muted-foreground">
                    {formatearHora(s.hora_inicio)} – {horaFin(s.hora_inicio, s.duracion_minutos)}
                  </p>
                  <p className="mt-1 text-sm font-medium">{tituloDe(s.curso_id)}</p>
                  <div className="mt-2 flex gap-2">
                    {s.enlace_virtual && (
                      <a href={s.enlace_virtual} target="_blank" rel="noreferrer" className={buttonVariants({ size: "sm" })}>
                        <VideoIcon /> Iniciar
                      </a>
                    )}
                    <Link href={`/instructor/asistencia?curso=${s.curso_id}&sesion=${s.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                      Asistencia
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EstadoVacio icono={CalendarDaysIcon} titulo="Sin sesiones hoy" className="m-4 border-0 py-8" />
          )}
        </section>
      </div>
    </div>
  );
}
