import {
  ArrowRightIcon,
  ArrowUpRightIcon,
  AwardIcon,
  BadgeCheckIcon,
  BookOpenCheckIcon,
  CalendarClockIcon,
  CreditCardIcon,
  GraduationCapIcon,
  LineChartIcon,
  SearchIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UserRoundCheckIcon,
} from "lucide-react";
import Link from "next/link";
import { EstadoVacio } from "@/components/comunes";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listarCategorias, listarCursosPublicados } from "@/features/catalogo/consultas";
import { CursoCard, IndicadorCupo } from "@/features/catalogo/curso-card";
import { degradadoCategoria, PortadaCurso } from "@/features/catalogo/portada-curso";
import { ETIQUETA_NIVEL, formatearFecha, formatearHora, formatearSoles } from "@/lib/formato";
import { cn } from "@/lib/utils";

const PASOS = [
  {
    icono: SearchIcon,
    titulo: "Elige tu curso",
    texto: "Revisa horario, cupos disponibles, temario, instructor y precio en el catálogo.",
    tono: "from-brand-500 to-violet-500",
  },
  {
    icono: CreditCardIcon,
    titulo: "Inscríbete y paga en línea",
    texto: "Tarjeta, Yape o Plin, con boleta o factura electrónica al instante.",
    tono: "from-orange-400 to-rose-500",
  },
  {
    icono: BookOpenCheckIcon,
    titulo: "Aprende en tu portal",
    texto: "Accede a sesiones, materiales y evaluaciones, y sigue tu progreso por curso.",
    tono: "from-teal-400 to-emerald-500",
  },
  {
    icono: AwardIcon,
    titulo: "Certifícate",
    texto: "Descarga tu certificado digital con un código único verificable públicamente.",
    tono: "from-amber-400 to-orange-500",
  },
];

const BENEFICIOS = [
  { icono: CalendarClockIcon, titulo: "Inscripción 24/7", texto: "Sin colas ni fichas físicas: matricúlate desde cualquier dispositivo." },
  { icono: LineChartIcon, titulo: "Progreso al día", texto: "Asistencia, notas y avance de cada curso en tiempo real." },
  { icono: ShieldCheckIcon, titulo: "Certificados verificables", texto: "Empleadores validan tu certificado con su código único." },
];

// HU-48 · Página de inicio
export default async function InicioPage() {
  const [cursos, categorias] = await Promise.all([listarCursosPublicados(), listarCategorias()]);
  const destacado = cursos[0];
  const proximos = cursos.slice(destacado ? 1 : 0, 5);
  const porCategoria = new Map<string, number>();
  cursos.forEach((c) => c.categoria && porCategoria.set(c.categoria.slug, (porCategoria.get(c.categoria.slug) ?? 0) + 1));

  return (
    <>
      {/* ---------- Hero ---------- */}
      <section className="relative overflow-hidden border-b">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-40 -left-32 size-[34rem] rounded-full bg-brand-400/25 blur-3xl dark:bg-brand-600/25" />
          <div className="absolute top-10 right-[-10rem] size-[30rem] rounded-full bg-fuchsia-300/25 blur-3xl dark:bg-fuchsia-600/15" />
          <div className="absolute -bottom-40 left-1/3 size-[28rem] rounded-full bg-orange-300/30 blur-3xl dark:bg-orange-500/10" />
          <div className="fondo-puntos absolute inset-0 text-brand-900/[0.06] [mask-image:linear-gradient(to_bottom,black,transparent)] dark:text-white/[0.05]" />
        </div>
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-12 lg:px-8 lg:py-24">
          <div className="lg:col-span-7">
            <p className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white/70 px-3 py-1 text-xs font-semibold text-brand-700 shadow-xs backdrop-blur dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-200">
              <SparklesIcon className="size-3.5 text-orange-500" />
              Cursos y capacitaciones en tecnología · Ica, Perú
            </p>
            <h1 className="mt-5 text-4xl leading-[1.05] font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
              Aprende tecnología con cursos prácticos y <span className="texto-degradado">certificación verificable</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground">
              Inscríbete en línea las 24 horas, paga con tarjeta, Yape o Plin y sigue tus clases, materiales y evaluaciones
              desde cualquier dispositivo.
            </p>
            <form action="/cursos" role="search" className="mt-8 flex max-w-xl flex-col gap-2 rounded-2xl border bg-card p-2 shadow-lg shadow-brand-900/5 sm:flex-row">
              <label className="relative flex-1">
                <span className="sr-only">Buscar cursos</span>
                <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  name="q"
                  placeholder="¿Qué quieres aprender? Ej. Python, Excel, redes"
                  className="h-11 border-0 bg-transparent pl-9 shadow-none focus-visible:ring-0 dark:bg-transparent"
                />
              </label>
              <Button type="submit" className="h-11 bg-linear-to-r from-brand-600 to-violet-600 px-6 text-base shadow-md shadow-brand-600/30 hover:opacity-90">
                Buscar cursos
              </Button>
            </form>
            {categorias.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">Explora:</span>
                {categorias.slice(0, 4).map((c) => (
                  <Link
                    key={c.id}
                    href={`/cursos?categoria=${c.slug}`}
                    className="rounded-full border bg-card/70 px-3 py-1 transition hover:border-brand-300 hover:text-primary"
                  >
                    {c.nombre}
                  </Link>
                ))}
              </div>
            )}
            <dl className="mt-10 grid max-w-xl grid-cols-3 gap-4 border-t pt-6">
              {[
                { v: "24/7", t: "Inscripción en línea" },
                { v: "100 %", t: "Pagos digitales" },
                { v: "QR", t: "Certificado verificable" },
              ].map((d) => (
                <div key={d.t}>
                  <dt className="text-xs text-muted-foreground">{d.t}</dt>
                  <dd className="mt-1 text-2xl font-bold tracking-tight">{d.v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="relative lg:col-span-5">
            <div className="absolute -inset-4 -z-10 rotate-3 rounded-[2rem] bg-linear-to-br from-brand-500/20 via-fuchsia-400/15 to-orange-400/20 blur-sm" />
            {destacado ? (
              <div className="overflow-hidden rounded-3xl border bg-card shadow-2xl shadow-brand-900/15">
                <div className="flex items-center justify-between border-b px-5 py-3 text-xs">
                  <span className="flex items-center gap-2 font-semibold">
                    <span className="relative flex size-2">
                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                    </span>
                    Inscripciones abiertas
                  </span>
                  <span className="text-muted-foreground">
                    {destacado.proxima_sesion ? `Inicia ${formatearFecha(destacado.proxima_sesion.fecha)}` : "Próximamente"}
                  </span>
                </div>
                <PortadaCurso
                  titulo={destacado.titulo}
                  imagen={destacado.imagen_url}
                  categoria={destacado.categoria}
                  modalidad={destacado.modalidad}
                  sinCupo={destacado.cupo_disponible <= 0}
                  className="h-44"
                />
                <div className="p-5">
                  <p className="text-sm font-medium text-primary">
                    {[destacado.categoria?.nombre, ETIQUETA_NIVEL[destacado.nivel], `${destacado.duracion_horas} horas`]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <h2 className="mt-1 text-lg font-bold">{destacado.titulo}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {[
                      destacado.proxima_sesion && formatearHora(destacado.proxima_sesion.hora_inicio),
                      destacado.instructor,
                    ]
                      .filter(Boolean)
                      .join(" · ") || destacado.descripcion}
                  </p>
                  <div className="mt-4">
                    <IndicadorCupo disponible={destacado.cupo_disponible} maximo={destacado.cupo_maximo} />
                  </div>
                  <div className="mt-5 flex items-center justify-between">
                    <span className="text-2xl font-bold tabular-nums">{formatearSoles(destacado.precio)}</span>
                    <Link href={`/cursos/${destacado.slug}`} className={buttonVariants({ className: "h-10 px-4" })}>
                      Inscribirme
                      <ArrowRightIcon />
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <TarjetaCertificadoDemo />
            )}
            <div className="absolute -bottom-5 -left-4 hidden items-center gap-2 rounded-2xl border bg-card px-3 py-2 text-xs font-semibold shadow-xl sm:flex">
              <span className="grid size-7 place-items-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                <BadgeCheckIcon className="size-4" />
              </span>
              Certificado con código único
            </div>
            <div className="absolute -top-4 -right-3 hidden items-center gap-1.5 rounded-2xl border bg-card px-3 py-2 text-xs font-semibold shadow-xl sm:flex">
              <span className="rounded-md bg-[#742284] px-1.5 py-0.5 text-[10px] text-white">Yape</span>
              <span className="rounded-md bg-[#00b6c7] px-1.5 py-0.5 text-[10px] text-white">Plin</span>
              <span className="rounded-md bg-brand-600 px-1.5 py-0.5 text-[10px] text-white">Tarjeta</span>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Próximos cursos ---------- */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">Inscripciones abiertas</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight">Próximos cursos</h2>
          </div>
          <Link href="/cursos" className={buttonVariants({ variant: "outline", className: "h-9 px-4" })}>
            Ver catálogo completo <ArrowRightIcon />
          </Link>
        </div>
        {proximos.length > 0 ? (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {proximos.map((c) => (
              <CursoCard key={c.id} curso={c} />
            ))}
          </div>
        ) : (
          <EstadoVacio
            icono={GraduationCapIcon}
            titulo={destacado ? "Pronto publicaremos más cursos" : "Pronto publicaremos nuevos cursos"}
            descripcion="Estamos preparando la próxima convocatoria. Crea tu cuenta para recibir el aviso de apertura."
            className="mt-8"
          >
            <Link href="/registro" className={buttonVariants()}>
              Crear cuenta
            </Link>
          </EstadoVacio>
        )}
      </section>

      {/* ---------- Cómo funciona ---------- */}
      <section className="relative overflow-hidden border-y bg-card">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">Cómo funciona</p>
          <h2 className="mt-2 max-w-2xl text-3xl font-bold tracking-tight">De la inscripción al certificado, sin fichas físicas ni colas</h2>
          <div className="relative mt-12">
          <div aria-hidden className="absolute top-7 right-[12%] left-[12%] hidden h-0.5 bg-linear-to-r from-brand-300 via-orange-300 to-amber-300 lg:block dark:opacity-40" />
          <ol className="relative grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {PASOS.map((p, i) => (
              <li key={p.titulo} className="relative">
                <span className={cn("relative grid size-14 place-items-center rounded-2xl bg-linear-to-br text-white shadow-lg", p.tono)}>
                  <p.icono className="size-6" />
                  <span className="absolute -top-2 -right-2 grid size-6 place-items-center rounded-full border-2 border-card bg-foreground font-mono text-[11px] font-bold text-background">
                    {i + 1}
                  </span>
                </span>
                <h3 className="mt-5 font-semibold">{p.titulo}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{p.texto}</p>
              </li>
            ))}
          </ol>
          </div>
        </div>
      </section>

      {/* ---------- Categorías ---------- */}
      {categorias.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">Categorías</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight">Explora por área</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {categorias.map((c) => {
              const n = porCategoria.get(c.slug) ?? 0;
              return (
                <Link
                  key={c.id}
                  href={`/cursos?categoria=${c.slug}`}
                  className="group relative flex items-center gap-4 overflow-hidden rounded-2xl border bg-card p-4 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-brand-500/10"
                >
                  <span
                    className={cn(
                      "grid size-12 shrink-0 place-items-center rounded-xl bg-linear-to-br font-mono text-sm font-bold text-white shadow-sm",
                      degradadoCategoria(c.slug),
                    )}
                  >
                    {c.nombre.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{c.nombre}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {n} curso{n === 1 ? "" : "s"}
                      {c.descripcion ? ` · ${c.descripcion}` : ""}
                    </p>
                  </div>
                  <ArrowUpRightIcon className="size-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary" />
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ---------- Beneficios ---------- */}
      <section className={cn("mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8", categorias.length === 0 && "pt-20")}>
        <div className="grid gap-4 md:grid-cols-3">
          {BENEFICIOS.map((b) => (
            <div key={b.titulo} className="rounded-2xl border bg-linear-to-br from-card to-brand-50/60 p-6 dark:to-brand-500/5">
              <b.icono className="size-6 text-primary" />
              <h3 className="mt-4 font-semibold">{b.titulo}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{b.texto}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- Verificación ---------- */}
      <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
        <div className="fondo-marca relative grid items-center gap-8 overflow-hidden rounded-3xl p-8 text-white shadow-2xl shadow-brand-900/20 sm:p-12 lg:grid-cols-2">
          <div className="fondo-puntos pointer-events-none absolute inset-0 text-white/10" />
          <div className="relative">
            <UserRoundCheckIcon className="size-8 text-orange-300" />
            <h2 className="mt-4 text-3xl font-bold tracking-tight">¿Recibiste un certificado PEDSAR?</h2>
            <p className="mt-3 text-brand-100/90">
              Empleadores e instituciones pueden comprobar su autenticidad con el código impreso en el documento.
            </p>
          </div>
          <form action="/verificar" className="relative flex flex-col gap-2 rounded-2xl bg-white/10 p-2 ring-1 ring-white/20 backdrop-blur sm:flex-row">
            <label className="flex-1">
              <span className="sr-only">Código de certificado</span>
              <Input
                name="codigo"
                required
                placeholder="PED-2026-XXXXXXXX"
                className="h-12 border-0 bg-transparent font-mono text-base text-white uppercase placeholder:text-white/50 focus-visible:ring-0 dark:bg-transparent"
              />
            </label>
            <Button type="submit" className="h-12 bg-white px-6 text-base text-brand-800 hover:bg-orange-50">
              Verificar
            </Button>
          </form>
        </div>
      </section>
    </>
  );
}

/** Tarjeta decorativa del hero cuando aún no hay cursos publicados. */
function TarjetaCertificadoDemo() {
  return (
    <div className="overflow-hidden rounded-3xl border bg-card p-6 shadow-2xl shadow-brand-900/15">
      <div className="rounded-2xl border-2 border-brand-600/70 p-6 text-center">
        <p className="text-[10px] font-semibold tracking-[0.3em] text-brand-700 uppercase dark:text-brand-300">
          Certificado de aprobación
        </p>
        <p className="mt-3 text-xs text-muted-foreground">Otorgado a</p>
        <p className="mt-1 text-xl font-bold">Tu nombre aquí</p>
        <p className="mx-auto mt-2 max-w-xs text-xs text-muted-foreground">
          por haber aprobado satisfactoriamente el curso, con código único verificable en línea.
        </p>
        <div className="mt-5 flex items-center justify-center gap-3">
          <span className="grid size-12 place-items-center rounded-lg border font-mono text-[10px] text-muted-foreground">QR</span>
          <span className="font-mono text-xs">PED-2026-XXXXXXXX</span>
        </div>
      </div>
    </div>
  );
}
