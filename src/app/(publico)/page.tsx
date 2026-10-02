import {
  ArrowRightIcon,
  ArrowUpRightIcon,
  AwardIcon,
  BadgeCheckIcon,
  BookOpenCheckIcon,
  CalendarClockIcon,
  CircleCheckIcon,
  CreditCardIcon,
  GraduationCapIcon,
  LineChartIcon,
  QrCodeIcon,
  SearchIcon,
  ShieldCheckIcon,
  WalletIcon,
} from "lucide-react";
import Link from "next/link";
import { EstadoVacio } from "@/components/comunes";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listarCategorias, listarCursosPublicados } from "@/features/catalogo/consultas";
import { CursoCard, IndicadorCupo } from "@/features/catalogo/curso-card";
import { degradadoCategoria, IconoCategoria, PortadaCurso } from "@/features/catalogo/portada-curso";
import { ETIQUETA_NIVEL, formatearFecha, formatearHora, formatearSoles } from "@/lib/formato";
import { pasarelaActiva } from "@/lib/pagos";
import { cn } from "@/lib/utils";

// Los textos de pago dependen de si la pasarela (Culqi) está configurada.
const pasos = (enLinea: boolean) => [
  { icono: SearchIcon, titulo: "Elige tu curso", texto: "Revisa horario, cupos disponibles, temario, instructor y precio en el catálogo." },
  enLinea
    ? { icono: CreditCardIcon, titulo: "Inscríbete y paga en línea", texto: "Tarjeta, Yape, Plin u otras billeteras; recibes tu comprobante de pago al instante." }
    : { icono: CreditCardIcon, titulo: "Inscríbete y paga", texto: "Paga por Yape o Plin y registra tu operación; validamos tu pago y te confirmamos." },
  { icono: BookOpenCheckIcon, titulo: "Aprende en tu portal", texto: "Accede a sesiones, materiales y evaluaciones, y sigue tu progreso por curso." },
  { icono: AwardIcon, titulo: "Certifícate", texto: "Descarga tu certificado digital con un código único verificable públicamente." },
];

const beneficios = (enLinea: boolean) => [
  { icono: CalendarClockIcon, titulo: "Inscripción 24/7", texto: "Sin colas ni fichas físicas: matricúlate desde cualquier dispositivo." },
  enLinea
    ? { icono: WalletIcon, titulo: "Pagos locales", texto: "Tarjeta, Yape, Plin u otras billeteras, con tu matrícula confirmada al instante." }
    : { icono: WalletIcon, titulo: "Pagos locales", texto: "Yape o Plin desde tu celular; validamos tu pago y te confirmamos por correo." },
  { icono: LineChartIcon, titulo: "Progreso al día", texto: "Asistencia, notas y avance de cada curso en tiempo real." },
  { icono: ShieldCheckIcon, titulo: "Certificados verificables", texto: "Empleadores validan tu certificado con su código único." },
];

/** Encabezado de sección: sobretítulo cian, título y acción opcional. */
function EncabezadoSeccion({ sobre, titulo, texto, accion, oscuro }: { sobre: string; titulo: string; texto?: string; accion?: React.ReactNode; oscuro?: boolean }) {
  return (
    <div className="revelar flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <p className={cn("text-xs font-semibold tracking-[0.08em] uppercase", oscuro ? "text-brand-400" : "text-brand-700 dark:text-brand-300")}>{sobre}</p>
        <h2 className={cn("mt-2 text-3xl font-semibold tracking-tight", oscuro && "text-white")}>{titulo}</h2>
        {texto && <p className={cn("mt-2", oscuro ? "text-zinc-400" : "text-muted-foreground")}>{texto}</p>}
      </div>
      {accion}
    </div>
  );
}

// HU-48 · Página de inicio
export default async function InicioPage() {
  const [cursos, categorias] = await Promise.all([listarCursosPublicados(), listarCategorias()]);
  const enLinea = pasarelaActiva();
  const destacado = cursos[0];
  const proximos = cursos.slice(destacado ? 1 : 0, 5);
  const porCategoria = new Map<string, number>();
  cursos.forEach((c) => c.categoria && porCategoria.set(c.categoria.slug, (porCategoria.get(c.categoria.slug) ?? 0) + 1));

  return (
    <>
      {/* ---------- Héroe ---------- */}
      <section className="relative overflow-hidden border-b bg-card">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-48 -left-40 size-[34rem] rounded-full bg-brand-300/20 blur-3xl dark:bg-brand-600/15" />
          <div className="fondo-puntos absolute inset-0 text-zinc-900/[0.05] [mask-image:linear-gradient(to_bottom,black,transparent)] dark:text-white/[0.04]" />
        </div>
        <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-4 py-16 sm:px-6 lg:grid-cols-12 lg:px-8 lg:py-20">
          <div className="lg:col-span-7">
            <p className="animar-entrada inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 py-1 pr-3 pl-1 text-sm font-medium text-brand-800 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-200">
              <span className="rounded-full bg-card px-2 py-0.5 text-xs font-semibold text-brand-700 shadow-xs dark:bg-brand-500/20 dark:text-brand-200">Nuevo</span>
              Inscripciones abiertas · Ica, Perú
            </p>
            <h1 className="animar-entrada mt-6 text-4xl leading-[1.08] font-bold tracking-tight [--i:1] sm:text-5xl lg:text-[3.5rem] lg:leading-[4rem]">
              Aprende tecnología con <span className="texto-degradado">certificación verificable</span>
            </h1>
            <p className="animar-entrada mt-6 max-w-xl text-lg text-muted-foreground [--i:2]">
              Cursos de programación, redes, ofimática e IA en Ica. Inscríbete en línea las 24 horas, paga con{" "}
              {enLinea ? "tarjeta, Yape o Plin" : "Yape o Plin"} y recibe tu certificado digital.
            </p>
            <form
              action="/cursos"
              role="search"
              className="animar-entrada mt-8 flex max-w-xl flex-col gap-2 rounded-xl border border-input bg-card p-1.5 shadow-lg shadow-zinc-900/5 transition-shadow [--i:3] focus-within:shadow-xl focus-within:shadow-brand-700/10 sm:flex-row"
            >
              <label className="relative flex-1">
                <span className="sr-only">Buscar cursos</span>
                <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  name="q"
                  placeholder="¿Qué quieres aprender? Ej.: Python, Excel"
                  className="h-11 border-0 bg-transparent pl-10 text-base shadow-none focus-visible:ring-0 dark:bg-transparent"
                />
              </label>
              <Button type="submit" size="lg">
                Buscar cursos
              </Button>
            </form>
            {categorias.length > 0 && (
              <div className="animar-entrada mt-4 flex flex-wrap items-center gap-2 text-sm [--i:4]">
                <span className="text-muted-foreground">Populares:</span>
                {categorias.slice(0, 4).map((c) => (
                  <Link
                    key={c.id}
                    href={`/cursos?categoria=${c.slug}`}
                    className="rounded-full border bg-card px-3.5 py-1.5 font-medium text-muted-foreground transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:text-primary"
                  >
                    {c.nombre}
                  </Link>
                ))}
              </div>
            )}
            <dl className="animar-entrada mt-10 grid max-w-xl grid-cols-3 gap-4 border-t pt-6 [--i:5]">
              {[
                { v: "24/7", t: "Inscripción en línea" },
                { v: "100 %", t: "Pagos digitales" },
                { v: "QR", t: "Certificado verificable" },
              ].map((d) => (
                <div key={d.t}>
                  <dt className="text-xs text-muted-foreground">{d.t}</dt>
                  <dd className="mt-1 text-2xl font-semibold tracking-tight">{d.v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="animar-escala relative [--i:2] lg:col-span-5">
            <div className="fondo-marca relative overflow-hidden rounded-3xl p-6 pt-16 shadow-2xl shadow-brand-900/25 sm:p-8 sm:pt-20">
              <div className="fondo-puntos pointer-events-none absolute inset-0 text-white/[0.06]" />
              <GraduationCapIcon className="pointer-events-none absolute top-6 left-6 size-28 text-brand-300/25" strokeWidth={1.4} />
              <div className="relative">{destacado ? <TarjetaDestacado curso={destacado} /> : <TarjetaCertificadoDemo />}</div>
            </div>
            {/* Tarjetas flotantes */}
            <div className="animar-escala absolute -top-5 -right-3 hidden [--i:5] sm:block" aria-hidden>
              <div className="flotar flex items-center gap-3 rounded-2xl border bg-card p-3 pr-4 shadow-xl">
                <span className="grid size-9 place-items-center rounded-lg bg-[#742284] text-sm font-semibold text-white">Y</span>
                <span className="leading-tight">
                  <span className="block text-sm font-medium">Pago con Yape aprobado</span>
                  <span className="block text-xs text-muted-foreground">Comprobante al instante</span>
                </span>
                <CircleCheckIcon className="size-5 text-green-600" />
              </div>
            </div>
            <div className="animar-escala absolute -bottom-6 -left-5 hidden [--i:6] sm:block" aria-hidden>
              <div className="flotar flex items-center gap-3 rounded-2xl border bg-card p-3 pr-4 shadow-xl [animation-delay:-3s]">
                <span className="grid size-9 place-items-center rounded-lg bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-300">
                  <BadgeCheckIcon className="size-5" />
                </span>
                <span className="leading-tight">
                  <span className="block text-sm font-medium">Certificado verificado</span>
                  <span className="block font-mono text-xs text-muted-foreground">PED-2026-7Q4K9X2M</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Beneficios ---------- */}
      <section className="mx-auto max-w-7xl px-4 pt-12 sm:px-6 lg:px-8">
        <div className="escalonado grid gap-8 rounded-2xl border bg-card p-8 shadow-xs sm:grid-cols-2 lg:grid-cols-4">
          {beneficios(enLinea).map((b) => (
            <div key={b.titulo} className="group">
              <span className="grid size-11 place-items-center rounded-lg bg-brand-50 text-brand-700 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110 dark:bg-brand-500/15 dark:text-brand-300">
                <b.icono className="size-5" />
              </span>
              <h3 className="mt-4 text-lg font-semibold tracking-tight">{b.titulo}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{b.texto}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- Próximos cursos ---------- */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <EncabezadoSeccion
          sobre="Inscripciones abiertas"
          titulo="Próximos cursos"
          texto="Empiezan en las próximas semanas. Cupos limitados."
          accion={
            <Link href="/cursos" className={buttonVariants({ variant: "outline", className: "group" })}>
              Ver todo el catálogo <ArrowRightIcon className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          }
        />
        {proximos.length > 0 ? (
          <div className="escalonado mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
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

      {/* ---------- Categorías ---------- */}
      {categorias.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
          <EncabezadoSeccion sobre="Categorías" titulo="Explora por área" />
          <div className="escalonado mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {categorias.map((c) => {
              const n = porCategoria.get(c.slug) ?? 0;
              return (
                <Link
                  key={c.id}
                  href={`/cursos?categoria=${c.slug}`}
                  className="elevar group relative flex items-center gap-4 overflow-hidden rounded-xl border bg-card p-4 shadow-xs hover:border-brand-200 dark:hover:border-brand-500/40"
                >
                  <span
                    className={cn(
                      "grid size-12 shrink-0 place-items-center rounded-lg bg-linear-to-br text-brand-100 shadow-sm transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105",
                      degradadoCategoria(c.slug),
                    )}
                  >
                    <IconoCategoria slug={c.slug} className="size-5.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{c.nombre}</p>
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

      {/* ---------- Cómo funciona ---------- */}
      <section className="relative overflow-hidden bg-zinc-900 dark:border-y dark:border-white/10 dark:bg-[#131316]">
        <div className="pointer-events-none absolute -top-40 right-0 size-[30rem] rounded-full bg-brand-600/15 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <EncabezadoSeccion oscuro sobre="Cómo funciona" titulo="De la inscripción al certificado, sin fichas ni colas" />
          <ol className="escalonado mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {pasos(enLinea).map((p, i) => (
              <li key={p.titulo} className="group border-t-2 border-brand-600 pt-6">
                <div className="flex items-center justify-between">
                  <span className="text-4xl font-bold text-brand-400">{i + 1}</span>
                  <span className="grid size-10 place-items-center rounded-lg bg-white/5 text-brand-300 ring-1 ring-white/10 transition-transform duration-300 group-hover:-translate-y-1 group-hover:rotate-6">
                    <p.icono className="size-5" />
                  </span>
                </div>
                <h3 className="mt-4 text-lg font-semibold text-white">{p.titulo}</h3>
                <p className="mt-2 text-sm text-zinc-400">{p.texto}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------- Verificación ---------- */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="revelar grid items-center gap-8 rounded-3xl border border-brand-200 bg-brand-50 p-8 sm:p-12 lg:grid-cols-2 dark:border-brand-500/25 dark:bg-brand-500/10">
          <div>
            <span className="grid size-12 place-items-center rounded-xl bg-card text-brand-700 shadow-xs dark:text-brand-300">
              <QrCodeIcon className="size-6" />
            </span>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight">¿Recibiste un certificado PEDSAR?</h2>
            <p className="mt-2 text-lg text-muted-foreground">
              Ingresa el código impreso o escanea el QR para confirmar su autenticidad al instante.
            </p>
          </div>
          <form action="/verificar" className="flex flex-col gap-2 rounded-xl border border-input bg-card p-1.5 shadow-sm sm:flex-row">
            <label className="relative flex-1">
              <span className="sr-only">Código de certificado</span>
              <QrCodeIcon className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                name="codigo"
                required
                placeholder="PED-2026-XXXXXXXX"
                className="h-11 border-0 bg-transparent pl-10 font-mono text-base uppercase shadow-none focus-visible:ring-0 dark:bg-transparent"
              />
            </label>
            <Button type="submit" size="lg">
              Verificar
            </Button>
          </form>
        </div>
      </section>
    </>
  );
}

/** Curso destacado dentro del panel del héroe. */
function TarjetaDestacado({ curso }: { curso: Awaited<ReturnType<typeof listarCursosPublicados>>[number] }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-card shadow-2xl">
      <div className="flex items-center justify-between border-b px-5 py-3 text-xs">
        <span className="flex items-center gap-2 font-semibold">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-green-500" />
          </span>
          Inscripciones abiertas
        </span>
        <span className="text-muted-foreground">{curso.proxima_sesion ? `Inicia ${formatearFecha(curso.proxima_sesion.fecha)}` : "Próximamente"}</span>
      </div>
      <PortadaCurso
        titulo={curso.titulo}
        imagen={curso.imagen_url}
        categoria={curso.categoria}
        modalidad={curso.modalidad}
        sinCupo={curso.cupo_disponible <= 0}
        destacado={curso.destacado}
        className="h-36"
      />
      <div className="p-5">
        <p className="text-xs font-semibold tracking-[0.08em] text-brand-700 uppercase dark:text-brand-300">
          {[curso.categoria?.nombre, ETIQUETA_NIVEL[curso.nivel]].filter(Boolean).join(" · ")}
        </p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight">{curso.titulo}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {[`${curso.duracion_horas} horas`, curso.proxima_sesion && formatearHora(curso.proxima_sesion.hora_inicio), curso.instructor]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <div className="mt-4">
          <IndicadorCupo disponible={curso.cupo_disponible} maximo={curso.cupo_maximo} />
        </div>
        <div className="mt-5 flex items-center justify-between">
          <span className="text-2xl font-semibold tracking-tight tabular-nums">{formatearSoles(curso.precio)}</span>
          <Link href={`/cursos/${curso.slug}`} className={buttonVariants({ className: "group" })}>
            Inscribirme
            <ArrowRightIcon className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

/** Tarjeta decorativa del héroe cuando aún no hay cursos publicados. */
function TarjetaCertificadoDemo() {
  return (
    <div className="overflow-hidden rounded-2xl bg-card p-6 shadow-2xl">
      <div className="rounded-xl border-2 border-brand-200 bg-linear-to-b from-card to-brand-50 p-6 text-center dark:border-brand-500/30 dark:to-brand-500/10">
        <p className="text-xs font-semibold tracking-[0.08em] text-brand-700 uppercase dark:text-brand-300">Certificado de aprobación</p>
        <p className="mt-3 text-xs text-muted-foreground">Otorgado a</p>
        <p className="mt-1 text-xl font-semibold">Tu nombre aquí</p>
        <p className="mx-auto mt-2 max-w-xs text-xs text-muted-foreground">
          por haber aprobado satisfactoriamente el curso, con código único verificable en línea.
        </p>
        <div className="mt-5 flex items-center justify-center gap-3">
          <QrCodeIcon className="size-10 text-foreground" />
          <span className="font-mono text-xs">PED-2026-XXXXXXXX</span>
        </div>
      </div>
    </div>
  );
}
