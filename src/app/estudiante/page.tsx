import type { Metadata } from "next";
import Link from "next/link";
import {
  AwardIcon,
  BookOpenIcon,
  CalendarIcon,
  ClipboardCheckIcon,
  ClockAlertIcon,
  CompassIcon,
  TrendingUpIcon,
  VideoIcon,
} from "lucide-react";
import { BarraProgreso, EstadoVacio, TarjetaKpi } from "@/components/comunes";
import { buttonVariants } from "@/components/ui/button";
import { listarEvaluacionesEstudiante, listarMisInscripciones, listarSesionesProximas } from "@/features/academico/consultas";
import { SiglaCurso } from "@/features/catalogo/portada-curso";
import { requireRol } from "@/lib/auth";
import { ETIQUETA_METODO, formatearDiaSemana, formatearFechaCorta, formatearHora, formatearSoles, horaFin, hoyISO } from "@/lib/formato";

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
      <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-brand-600 via-violet-600 to-fuchsia-600 p-6 text-white shadow-xl shadow-brand-900/15 sm:p-8">
        <div className="fondo-puntos pointer-events-none absolute inset-0 text-white/10" />
        <div className="pointer-events-none absolute -right-10 -bottom-20 size-64 rounded-full bg-orange-400/40 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-white/80">¡Qué bueno verte!</p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight">Hola, {nombre} 👋</h1>
            <p className="mt-2 text-sm text-white/85">
              {sesiones.length ? `Tienes ${sesiones.length} sesión(es) próximas` : "No tienes sesiones programadas"} y{" "}
              {evalPendientes.length} evaluación(es) pendiente(s).
            </p>
          </div>
          <Link href="/cursos" className={buttonVariants({ className: "h-10 bg-white px-4 text-brand-700 hover:bg-orange-50" })}>
            <CompassIcon /> Explorar cursos
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
          <h2 className="font-semibold">Continúa donde lo dejaste</h2>
          {activas.length ? (
            activas.map((i) => (
              <div key={i.id} className="flex flex-col gap-5 rounded-2xl border bg-card p-5 shadow-xs sm:flex-row sm:items-center">
                <SiglaCurso titulo={i.curso.titulo} categoria={i.curso.categoria?.slug} className="size-14 text-base" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-primary">{i.curso.categoria?.nombre ?? "Curso"}</p>
                  <p className="mt-0.5 font-semibold">{i.curso.titulo}</p>
                  <div className="mt-3 flex items-center gap-3">
                    <BarraProgreso valor={i.progreso.porcentaje} className="h-1.5" />
                    <span className="font-mono text-xs">{i.progreso.porcentaje} %</span>
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {i.progreso.completadas} de {i.progreso.total} lecciones completadas
                  </p>
                </div>
                <Link href={`/estudiante/cursos/${i.curso.id}`} className={buttonVariants({ className: "h-9 shrink-0 px-4" })}>
                  Continuar
                </Link>
              </div>
            ))
          ) : (
            <EstadoVacio icono={BookOpenIcon} titulo="Aún no tienes cursos activos" descripcion="Explora el catálogo e inscríbete en tu primer curso.">
              <Link href="/cursos" className={buttonVariants()}>
                Ver catálogo
              </Link>
            </EstadoVacio>
          )}
          {pendientes.map((i) => (
            <div key={i.id} className="flex items-start gap-3 rounded-2xl border border-amber-300/60 bg-amber-50 p-4 text-sm dark:border-amber-500/30 dark:bg-amber-500/10">
              <ClockAlertIcon className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-300" />
              <div className="flex-1">
                <p className="font-semibold text-amber-900 dark:text-amber-200">Pago pendiente · {i.curso.titulo}</p>
                <p className="mt-0.5 text-amber-800/80 dark:text-amber-200/70">
                  {i.pago ? `${ETIQUETA_METODO[i.pago.metodo]} · ${formatearSoles(i.pago.monto)}. ` : ""}Tu cupo se confirmará cuando se valide el pago.
                </p>
              </div>
              <Link href="/estudiante/pagos" className={buttonVariants({ variant: "outline", size: "sm" })}>
                Ver pago
              </Link>
            </div>
          ))}
        </div>

        <div className="space-y-6">
          <section className="overflow-hidden rounded-2xl border bg-card shadow-xs">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h2 className="font-semibold">Próximas sesiones</h2>
              <CalendarIcon className="size-4 text-muted-foreground" />
            </div>
            {sesiones.length ? (
              <ul className="divide-y">
                {sesiones.map((s, idx) => (
                  <li key={s.id} className="flex gap-4 px-5 py-4">
                    <div className="w-12 shrink-0 rounded-xl bg-brand-50 py-1.5 text-center dark:bg-brand-500/10">
                      <p className="text-[10px] font-semibold text-brand-600 uppercase dark:text-brand-300">{formatearDiaSemana(s.fecha)}</p>
                      <p className="text-lg leading-tight font-bold">{formatearFechaCorta(s.fecha).split(" ")[0]}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{s.curso.titulo}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatearHora(s.hora_inicio)} – {horaFin(s.hora_inicio, s.duracion_minutos)} · {s.modalidad === "PRESENCIAL" ? "Presencial" : "Virtual"}
                      </p>
                      {idx === 0 && s.enlace_virtual && (
                        <a href={s.enlace_virtual} target="_blank" rel="noreferrer" className={buttonVariants({ size: "sm", className: "mt-2" })}>
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
            <section className="rounded-2xl border bg-linear-to-br from-orange-50 to-rose-50 p-5 dark:from-orange-500/10 dark:to-rose-500/5">
              <h2 className="font-semibold">Evaluación pendiente</h2>
              <p className="mt-3 text-sm font-medium">{evalPendientes[0].titulo}</p>
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
