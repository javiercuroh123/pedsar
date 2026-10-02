import type { Metadata } from "next";
import Link from "next/link";
import {
  AwardIcon,
  BookOpenIcon,
  CalendarIcon,
  ClipboardCheckIcon,
  ClockAlertIcon,
  CompassIcon,
  PlayIcon,
  TrendingUpIcon,
  VideoIcon,
} from "lucide-react";
import { BarraProgreso, EncabezadoPagina, EstadoVacio, TarjetaKpi } from "@/components/comunes";
import { buttonVariants } from "@/components/ui/button";
import { listarEvaluacionesEstudiante, listarMisInscripciones, listarSesionesProximas } from "@/features/academico/consultas";
import { SiglaCurso } from "@/features/catalogo/portada-curso";
import { requireRol } from "@/lib/auth";
import {
  etiquetaPago,
  formatearDiaSemana,
  formatearFechaCorta,
  formatearHora,
  formatearSoles,
  horaFin,
  hoyISO,
  situacionPagoPendiente,
} from "@/lib/formato";

export const metadata: Metadata = { title: "Inicio" };

// HU-65 · Panel del estudiante · HU-10 · HU-41
export default async function EstudiantePage() {
  const usuario = await requireRol("estudiante");
  const inscripciones = await listarMisInscripciones(usuario.id);
  const activas = inscripciones.filter((i) => i.estado === "CONFIRMADA" && !i.certificado);
  const pendientes = inscripciones.filter((i) => i.estado === "PENDIENTE");
  const certificados = inscripciones.filter((i) => i.certificado);
  const confirmadas = inscripciones.filter((i) => i.estado === "CONFIRMADA");

  const [sesiones, evaluaciones] = await Promise.all([
    listarSesionesProximas(
      activas.map((i) => i.curso.id),
      hoyISO(),
    ),
    listarEvaluacionesEstudiante(confirmadas.map((i) => ({ id: i.id, cursoId: i.curso.id, titulo: i.curso.titulo }))),
  ]);
  const evalPendientes = evaluaciones.filter((e) => e.intentos.length === 0);
  const promedio = activas.length ? Math.round(activas.reduce((a, i) => a + i.progreso.porcentaje, 0) / activas.length) : 0;
  const nombre = usuario.nombres.split(" ")[0] || "estudiante";

  return (
    <div className="space-y-8">
      <EncabezadoPagina
        eyebrow="Estudiante"
        titulo={`¡Qué bueno verte, ${nombre}!`}
        descripcion={`${sesiones.length ? `Tienes ${sesiones.length} sesión(es) próximas` : "No tienes sesiones programadas"} y ${evalPendientes.length} evaluación(es) pendiente(s).`}
      >
        <Link href="/cursos" className={buttonVariants({ variant: "outline" })}>
          <CompassIcon /> Explorar cursos
        </Link>
      </EncabezadoPagina>

      <div className="escalonado grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <TarjetaKpi
          etiqueta="Cursos en curso"
          valor={activas.length}
          icono={BookOpenIcon}
          tono="indigo"
          detalle={pendientes.length ? `${pendientes.length} inscripción(es) pendiente(s) de pago` : "Todo al día"}
        />
        <TarjetaKpi etiqueta="Avance promedio" valor={`${promedio} %`} icono={TrendingUpIcon} tono="turquesa" detalle={<BarraProgreso valor={promedio} tono="turquesa" className="mt-2 h-1.5" />} />
        <TarjetaKpi etiqueta="Evaluaciones pendientes" valor={evalPendientes.length} icono={ClipboardCheckIcon} tono="coral" detalle={evalPendientes[0]?.titulo ?? "Sin pendientes"} />
        <TarjetaKpi etiqueta="Certificados" valor={certificados.length} icono={AwardIcon} tono="ambar" detalle={certificados[0]?.curso.titulo ?? "Completa un curso para obtenerlo"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <h2 className="text-lg font-semibold tracking-tight">Continúa donde lo dejaste</h2>
          {activas.length ? (
            <div className="escalonado space-y-4">
              {activas.map((i) => (
                <div key={i.id} className="elevar group flex flex-col gap-5 rounded-2xl border bg-card p-5 shadow-xs sm:flex-row sm:items-center">
                  <div className="relative shrink-0">
                    <SiglaCurso
                      titulo={i.curso.titulo}
                      categoria={i.curso.categoria?.slug}
                      className="h-28 w-full rounded-xl transition-transform duration-500 group-hover:scale-[1.03] sm:w-44"
                    />
                    <span className="absolute right-3 bottom-3 grid size-9 place-items-center rounded-full bg-white text-primary shadow-md transition-transform duration-300 group-hover:scale-110">
                      <PlayIcon className="size-4 fill-current" />
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold tracking-[0.08em] text-brand-700 uppercase dark:text-brand-300">
                      {i.curso.categoria?.nombre ?? "Curso"}
                    </p>
                    <p className="mt-1 text-lg leading-snug font-semibold tracking-tight">{i.curso.titulo}</p>
                    <div className="mt-3 flex items-center justify-between text-sm">
                      <span className="font-medium">{i.progreso.porcentaje} % completado</span>
                      <span className="text-xs text-muted-foreground">
                        {i.progreso.completadas} de {i.progreso.total} lecciones
                      </span>
                    </div>
                    <BarraProgreso valor={i.progreso.porcentaje} className="mt-2" />
                  </div>
                  <Link href={`/estudiante/cursos/${i.curso.id}`} className={buttonVariants({ className: "shrink-0" })}>
                    <PlayIcon className="fill-current" /> Continuar
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <EstadoVacio icono={BookOpenIcon} titulo="Aún no tienes cursos activos" descripcion="Explora el catálogo e inscríbete en tu primer curso.">
              <Link href="/cursos" className={buttonVariants()}>
                Ver catálogo
              </Link>
            </EstadoVacio>
          )}
          {pendientes.map((i) => (
            <div key={i.id} className="animar-entrada flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-500/30 dark:bg-amber-500/10">
              <ClockAlertIcon className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-300" />
              <div className="flex-1">
                <p className="font-semibold text-amber-900 dark:text-amber-200">Pago pendiente · {i.curso.titulo}</p>
                <p className="mt-0.5 text-amber-800/80 dark:text-amber-200/70">
                  {i.pago ? `${etiquetaPago(i.pago.metodo, i.pago.medio)} · ${formatearSoles(i.pago.monto)} · ${situacionPagoPendiente(i.pago, i).texto}. ` : ""}Tu cupo se
                  confirmará cuando se valide el pago.
                </p>
              </div>
              <Link href={i.pago?.metodo === "CULQI" ? `/estudiante/pagos?pagar=${i.codigo}` : "/estudiante/pagos"} className={buttonVariants({ variant: "outline", size: "sm" })}>
                {i.pago ? situacionPagoPendiente(i.pago, i).accion : "Ver pago"}
              </Link>
            </div>
          ))}
        </div>

        <div className="space-y-6">
          <section className="animar-entrada overflow-hidden rounded-2xl border bg-card shadow-xs [--i:2]">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h2 className="text-lg font-semibold tracking-tight">Próximas sesiones</h2>
              <CalendarIcon className="size-4 text-muted-foreground" />
            </div>
            {sesiones.length ? (
              <ul className="divide-y">
                {sesiones.map((s, idx) => (
                  <li key={s.id} className="flex gap-4 px-5 py-4 transition-colors hover:bg-muted/40">
                    <div className="w-14 shrink-0 rounded-lg bg-brand-50 py-1.5 text-center text-brand-800 dark:bg-brand-500/10 dark:text-brand-200">
                      <p className="text-[11px] font-semibold tracking-wider uppercase">{formatearDiaSemana(s.fecha)}</p>
                      <p className="text-xl leading-tight font-semibold">{formatearFechaCorta(s.fecha).split(" ")[0]}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{s.curso.titulo}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatearHora(s.hora_inicio)} – {horaFin(s.hora_inicio, s.duracion_minutos)} · {s.modalidad === "PRESENCIAL" ? "Presencial" : "Virtual"}
                      </p>
                      {idx === 0 && s.enlace_virtual && (
                        <a
                          href={s.enlace_virtual}
                          target="_blank"
                          rel="noreferrer"
                          className={buttonVariants({ variant: "secondary", size: "sm", className: "mt-2 bg-brand-50 text-brand-800 hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-200" })}
                        >
                          <VideoIcon /> Unirse
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">No hay sesiones programadas.</p>
            )}
          </section>

          {evalPendientes[0] && (
            <section className="animar-entrada rounded-2xl border border-amber-200 bg-card p-5 shadow-xs [--i:3] dark:border-amber-500/30">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                  <ClipboardCheckIcon className="size-5" />
                </span>
                <h2 className="text-lg font-semibold tracking-tight">Evaluación pendiente</h2>
              </div>
              <p className="mt-4 text-sm font-medium">{evalPendientes[0].titulo}</p>
              <p className="text-xs text-muted-foreground">
                {evalPendientes[0].curso.titulo}
                {evalPendientes[0].tiempo_limite_min ? ` · ${evalPendientes[0].tiempo_limite_min} min` : ""} · {evalPendientes[0].intentos_permitidos}{" "}
                intento(s)
              </p>
              <Link href={`/estudiante/evaluaciones/${evalPendientes[0].id}`} className={buttonVariants({ className: "mt-4 w-full" })}>
                Ir a la evaluación
              </Link>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
