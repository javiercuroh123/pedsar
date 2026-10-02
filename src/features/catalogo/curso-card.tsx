import { ArrowRightIcon, CalendarDaysIcon, ClockIcon, SignalIcon, UserRoundIcon } from "lucide-react";
import Link from "next/link";
import { BarraProgreso } from "@/components/comunes";
import { ResumenCalificacion } from "@/features/comunidad/estrellas";
import { ETIQUETA_NIVEL, formatearFecha, formatearHora, formatearSoles } from "@/lib/formato";
import { cn } from "@/lib/utils";
import type { CursoResumen } from "./consultas";
import { PortadaCurso } from "./portada-curso";

/** Indicador de cupos: se vuelve ámbar con pocos cupos y rojo cuando se llena. */
export function IndicadorCupo({ disponible, maximo }: { disponible: number; maximo: number }) {
  const libres = Math.max(disponible, 0);
  const ocupados = maximo - libres;
  const lleno = libres === 0;
  const pocos = !lleno && libres <= 5;
  return (
    <div>
      <div className="flex justify-between text-xs">
        <span
          className={cn(
            "font-medium",
            lleno ? "text-red-600 dark:text-red-400" : pocos ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground",
          )}
        >
          {lleno ? "Cupo lleno" : `${libres} cupo${libres === 1 ? "" : "s"} disponible${libres === 1 ? "" : "s"}`}
        </span>
        <span className="font-mono text-muted-foreground">
          {ocupados}/{maximo}
        </span>
      </div>
      <BarraProgreso
        valor={(ocupados / maximo) * 100}
        tono={lleno ? "rojo" : pocos ? "ambar" : "indigo"}
        className="mt-1.5 h-1.5"
        etiqueta="Ocupación del curso"
      />
    </div>
  );
}

export function CursoCard({ curso }: { curso: CursoResumen }) {
  const sinCupo = curso.cupo_disponible <= 0;
  return (
    <article className="elevar group relative flex flex-col overflow-hidden rounded-2xl border bg-card shadow-xs hover:border-brand-200 dark:hover:border-brand-500/40">
      <PortadaCurso
        titulo={curso.titulo}
        imagen={curso.imagen_url}
        categoria={curso.categoria}
        modalidad={curso.modalidad}
        sinCupo={sinCupo}
        destacado={curso.destacado}
      />
      <div className="flex flex-1 flex-col p-5">
        {curso.categoria && <p className="text-xs font-semibold tracking-[0.08em] text-brand-700 uppercase dark:text-brand-300">{curso.categoria.nombre}</p>}
        <h3 className="mt-1.5 text-lg leading-snug font-semibold tracking-tight">
          <Link href={`/cursos/${curso.slug}`} className="transition-colors after:absolute after:inset-0 hover:text-primary">
            {curso.titulo}
          </Link>
        </h3>
        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <ClockIcon className="size-4 shrink-0" />
            {curso.duracion_horas} horas
          </span>
          <span className="flex items-center gap-1.5">
            <SignalIcon className="size-4 shrink-0" />
            {ETIQUETA_NIVEL[curso.nivel]}
          </span>
          {curso.calificacion && <ResumenCalificacion promedio={curso.calificacion.promedio} cantidad={curso.calificacion.cantidad} />}
        </div>
        <div className="mt-2 space-y-1.5 text-sm text-muted-foreground">
          {curso.instructor && (
            <p className="flex items-center gap-2">
              <UserRoundIcon className="size-4 shrink-0" />
              {curso.instructor}
            </p>
          )}
          {curso.proxima_sesion ? (
            <p className="flex items-center gap-2">
              <CalendarDaysIcon className="size-4 shrink-0" />
              Inicia {formatearFecha(curso.proxima_sesion.fecha)} · {formatearHora(curso.proxima_sesion.hora_inicio)}
            </p>
          ) : (
            <p className="flex items-center gap-2">
              <CalendarDaysIcon className="size-4 shrink-0" />
              Horario por confirmar
            </p>
          )}
        </div>
        <div className="mt-4">
          <IndicadorCupo disponible={curso.cupo_disponible} maximo={curso.cupo_maximo} />
        </div>
        <div className="mt-auto flex items-end justify-between border-t pt-4" style={{ marginTop: "1.25rem" }}>
          <p className="text-[1.375rem] font-semibold tracking-tight tabular-nums">{formatearSoles(curso.precio)}</p>
          <span className="relative inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 text-sm font-medium transition-colors duration-300 group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground">
            Ver curso
            <ArrowRightIcon className="size-4 -translate-x-1 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100" />
          </span>
        </div>
      </div>
    </article>
  );
}
