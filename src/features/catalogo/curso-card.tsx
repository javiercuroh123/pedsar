import { CalendarDaysIcon, ClockIcon, UserRoundIcon } from "lucide-react";
import Link from "next/link";
import { BarraProgreso } from "@/components/comunes";
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
            lleno ? "text-rose-600 dark:text-rose-400" : pocos ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground",
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
        tono={lleno ? "rojo" : pocos ? "coral" : "indigo"}
        className="mt-1.5 h-1.5"
        etiqueta="Ocupación del curso"
      />
    </div>
  );
}

export function CursoCard({ curso }: { curso: CursoResumen }) {
  const sinCupo = curso.cupo_disponible <= 0;
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border bg-card shadow-xs transition duration-200 hover:-translate-y-1 hover:border-brand-300 hover:shadow-lg hover:shadow-brand-500/10 dark:hover:border-brand-500/40">
      <PortadaCurso
        titulo={curso.titulo}
        imagen={curso.imagen_url}
        categoria={curso.categoria}
        modalidad={curso.modalidad}
        sinCupo={sinCupo}
        className="transition-transform duration-300"
      />
      <div className="flex flex-1 flex-col p-5">
        <p className="text-xs font-medium text-primary">
          {[curso.categoria?.nombre, ETIQUETA_NIVEL[curso.nivel], `${curso.duracion_horas} h`].filter(Boolean).join(" · ")}
        </p>
        <h3 className="mt-1.5 leading-snug font-semibold">
          <Link href={`/cursos/${curso.slug}`} className="after:absolute after:inset-0 hover:text-primary">
            {curso.titulo}
          </Link>
        </h3>
        <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
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
              <ClockIcon className="size-4 shrink-0" />
              Horario por confirmar
            </p>
          )}
        </div>
        <div className="mt-4">
          <IndicadorCupo disponible={curso.cupo_disponible} maximo={curso.cupo_maximo} />
        </div>
        <div className="mt-auto flex items-end justify-between border-t pt-4" style={{ marginTop: "1.25rem" }}>
          <p className="text-xl font-bold tabular-nums">{formatearSoles(curso.precio)}</p>
          <span className="relative rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground transition group-hover:bg-primary group-hover:text-primary-foreground">
            Ver curso
          </span>
        </div>
      </div>
    </article>
  );
}
