import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRightIcon,
  AwardIcon,
  CalendarDaysIcon,
  CheckCircle2Icon,
  ChevronRightIcon,
  ClockIcon,
  FolderDownIcon,
  LayersIcon,
  ReceiptIcon,
  UsersIcon,
} from "lucide-react";
import { AvatarIniciales, EstadoVacio, tabla } from "@/components/comunes";
import { buttonVariants } from "@/components/ui/button";
import { reservaVencida } from "@/config/matricula";
import { obtenerCursoPorSlug } from "@/features/catalogo/consultas";
import { IndicadorCupo } from "@/features/catalogo/curso-card";
import { ICONO_MODALIDAD, PortadaCurso } from "@/features/catalogo/portada-curso";
import { getUsuarioActual } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  ETIQUETA_MODALIDAD,
  ETIQUETA_NIVEL,
  formatearDiaSemana,
  formatearFecha,
  formatearHora,
  formatearSoles,
  horaFin,
  hoyISO,
  nombreCompleto,
} from "@/lib/formato";
import { cn } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/cursos/[slug]">): Promise<Metadata> {
  const curso = await obtenerCursoPorSlug((await params).slug);
  return curso ? { title: curso.titulo, description: curso.descripcion ?? undefined } : {};
}

// HU-06 · Detalle de curso
export default async function CursoPage({ params }: PageProps<"/cursos/[slug]">) {
  const { slug } = await params;
  const [curso, usuario] = await Promise.all([obtenerCursoPorSlug(slug), getUsuarioActual()]);
  if (!curso) notFound();

  // ¿El estudiante ya está inscrito? Así no se le ofrece inscribirse otra vez (una reserva vencida no cuenta).
  let inscripcion: { estado: string } | null = null;
  if (usuario?.rol === "estudiante") {
    const supabase = await createClient();
    const { data } = await supabase
      .from("inscripciones")
      .select("estado, vence_en")
      .eq("curso_id", curso.id)
      .eq("estudiante_id", usuario.id)
      .neq("estado", "CANCELADA")
      .maybeSingle();
    inscripcion = data && !reservaVencida(data) ? data : null;
  }

  const sinCupo = curso.cupo_disponible <= 0;
  const hoy = hoyISO();
  const proximas = curso.sesiones.filter((s) => s.fecha >= hoy);
  const inicio = proximas[0] ?? curso.sesiones[0];
  const instructor = nombreCompleto(curso.instructor);
  const IconoModalidad = ICONO_MODALIDAD[curso.modalidad];

  return (
    <>
      <section className="fondo-marca relative overflow-hidden text-white">
        <div className="fondo-puntos pointer-events-none absolute inset-0 text-white/[0.06]" />
        <div className="relative mx-auto max-w-7xl px-4 pt-8 pb-12 sm:px-6 lg:px-8 lg:pb-16">
          <nav className="animar-entrada flex items-center gap-1.5 text-sm text-zinc-400" aria-label="Ruta">
            <Link href="/cursos" className="hover:text-white">
              Catálogo
            </Link>
            {curso.categoria && (
              <>
                <ChevronRightIcon className="size-3.5" />
                <Link href={`/cursos?categoria=${curso.categoria.slug}`} className="hover:text-white">
                  {curso.categoria.nombre}
                </Link>
              </>
            )}
          </nav>
          <div className="max-w-3xl lg:max-w-[calc(100%-400px)]">
            <div className="animar-entrada mt-6 flex flex-wrap gap-2 text-xs font-medium [--i:1]">
              {curso.destacado && <span className="rounded-full bg-rose-50 px-2.5 py-1 text-rose-700">Destacado</span>}
              <span className="rounded-full bg-brand-50 px-2.5 py-1 text-brand-800">{ETIQUETA_NIVEL[curso.nivel]}</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-1 text-violet-700">
                <IconoModalidad className="size-3" />
                {ETIQUETA_MODALIDAD[curso.modalidad]}
              </span>
            </div>
            <h1 className="animar-entrada mt-4 text-3xl font-bold tracking-tight [--i:2] sm:text-4xl lg:text-[2.75rem] lg:leading-[1.15]">{curso.titulo}</h1>
            {curso.descripcion && <p className="animar-entrada mt-4 text-lg text-zinc-300 [--i:3]">{curso.descripcion}</p>}
            <div className="animar-entrada mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-zinc-300 [--i:4]">
              <span className="flex items-center gap-1.5">
                <ClockIcon className="size-4" />
                {curso.duracion_horas} horas académicas
              </span>
              <span className="flex items-center gap-1.5">
                <LayersIcon className="size-4" />
                {curso.modulos.length} módulos
              </span>
              <span className="flex items-center gap-1.5">
                <UsersIcon className="size-4" />
                {curso.cupo_maximo - Math.max(curso.cupo_disponible, 0)} inscritos
              </span>
              {inicio && (
                <span className="flex items-center gap-1.5">
                  <CalendarDaysIcon className="size-4" />
                  Inicia {formatearFecha(inicio.fecha)}
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-8">
        <div className="min-w-0 space-y-12">
          <section>
            <h2 className="text-xl font-bold tracking-tight">Temario</h2>
            <p className="mt-1 text-sm text-muted-foreground">{curso.modulos.length} módulos organizados por semanas</p>
            {curso.modulos.length > 0 ? (
              <ol className="mt-4 overflow-hidden rounded-2xl border bg-card">
                {curso.modulos.map((m, i) => (
                  <li key={m.id} className="flex items-center gap-4 border-b px-5 py-4 last:border-0">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-50 font-mono text-xs font-bold text-brand-700 dark:bg-brand-500/15 dark:text-brand-200">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="text-sm font-medium">{m.titulo}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">El temario detallado se publicará pronto.</p>
            )}
          </section>

          <section>
            <h2 className="text-xl font-bold tracking-tight">Horario de sesiones</h2>
            {curso.sesiones.length > 0 ? (
              <div className="mt-4 overflow-x-auto rounded-2xl border bg-card">
                <table className={cn(tabla.table, "min-w-130")}>
                  <thead className={tabla.thead}>
                    <tr>
                      <th className={tabla.th}>Fecha</th>
                      <th className={tabla.th}>Horario</th>
                      <th className={tabla.th}>Modalidad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {curso.sesiones.map((s) => (
                      <tr key={s.id} className={cn(tabla.tr, s.fecha < hoy && "text-muted-foreground")}>
                        <td className={tabla.td}>
                          <span className="capitalize">{formatearDiaSemana(s.fecha)}</span> {formatearFecha(s.fecha)}
                        </td>
                        <td className={cn(tabla.td, "font-mono text-xs")}>
                          {formatearHora(s.hora_inicio)} – {horaFin(s.hora_inicio, s.duracion_minutos)}
                        </td>
                        <td className={tabla.td}>{ETIQUETA_MODALIDAD[s.modalidad]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EstadoVacio icono={CalendarDaysIcon} titulo="Horario por confirmar" descripcion="Te avisaremos por correo cuando se programen las sesiones." className="mt-4 py-10" />
            )}
          </section>

          {instructor && (
            <section>
              <h2 className="text-xl font-bold tracking-tight">Tu instructor</h2>
              <div className="mt-4 flex items-center gap-4 rounded-2xl border bg-card p-5">
                <AvatarIniciales nombre={instructor} src={curso.instructor?.avatar_url} className="size-14 text-base" />
                <div>
                  <p className="font-semibold">{instructor}</p>
                  <p className="text-sm text-muted-foreground">
                    {curso.instructor?.especialidad ?? `Especialista en ${curso.categoria?.nombre.toLowerCase() ?? "tecnología"}`}
                  </p>
                </div>
              </div>
            </section>
          )}
        </div>

        <aside className="animar-escala lg:sticky lg:top-24 lg:-mt-40 lg:self-start [--i:3]">
          <div className="overflow-hidden rounded-2xl border bg-card shadow-(--sombra-lg)">
            <PortadaCurso
              titulo={curso.titulo}
              imagen={curso.imagen_url}
              categoria={curso.categoria}
              modalidad={curso.modalidad}
              sinCupo={sinCupo}
              destacado={curso.destacado}
            />
            <div className="p-6">
              <p className="text-[2.5rem] leading-none font-bold tracking-tight tabular-nums">{formatearSoles(curso.precio)}</p>
              <p className="text-xs text-muted-foreground">Pago único · incluye certificado</p>
              <div className="mt-4">
                <IndicadorCupo disponible={curso.cupo_disponible} maximo={curso.cupo_maximo} />
              </div>
              {inscripcion ? (
                <Link href="/estudiante/cursos" className={buttonVariants({ variant: "secondary", className: "mt-5 h-11 w-full text-base" })}>
                  <CheckCircle2Icon />
                  {inscripcion.estado === "CONFIRMADA" ? "Ya estás inscrito · Ir a mis cursos" : "Inscripción en proceso"}
                </Link>
              ) : sinCupo ? (
                <span className={buttonVariants({ variant: "secondary", className: "mt-5 h-11 w-full text-base opacity-70" })}>Sin cupos disponibles</span>
              ) : (
                <Link
                  href={`/cursos/${curso.slug}/inscripcion`}
                  className={buttonVariants({ size: "lg", className: "group mt-5 w-full" })}
                >
                  Inscribirme ahora
                  <ArrowRightIcon className="transition-transform group-hover:translate-x-1" />
                </Link>
              )}
              <dl className="mt-6 space-y-3 border-t pt-5 text-sm">
                {[
                  ["Inicio", inicio ? formatearFecha(inicio.fecha) : "Por confirmar"],
                  ["Horario", inicio ? `${formatearHora(inicio.hora_inicio)} – ${horaFin(inicio.hora_inicio, inicio.duracion_minutos)}` : "Por confirmar"],
                  ["Modalidad", ETIQUETA_MODALIDAD[curso.modalidad]],
                  ["Duración", `${curso.duracion_horas} horas`],
                  ["Sesiones", String(curso.sesiones.length || "—")],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="text-right font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
              <ul className="mt-5 space-y-2 rounded-xl bg-muted/60 p-4 text-sm">
                <li className="flex items-center gap-2">
                  <AwardIcon className="size-4 text-rose-500" />
                  Certificado digital verificable
                </li>
                <li className="flex items-center gap-2">
                  <FolderDownIcon className="size-4 text-violet-600 dark:text-violet-400" />
                  Materiales descargables
                </li>
                <li className="flex items-center gap-2">
                  <ReceiptIcon className="size-4 text-brand-600 dark:text-brand-400" />
                  Boleta o factura electrónica
                </li>
              </ul>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
