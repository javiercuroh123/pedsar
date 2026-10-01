import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRightIcon, SearchXIcon, XIcon } from "lucide-react";
import { EstadoVacio } from "@/components/comunes";
import { buttonVariants } from "@/components/ui/button";
import { listarCategorias, listarCursosPublicados, type OrdenCatalogo } from "@/features/catalogo/consultas";
import { CursoCard } from "@/features/catalogo/curso-card";
import { FiltrosCatalogo, PRECIO_TOPE } from "@/features/catalogo/filtros-catalogo";
import { ETIQUETA_MODALIDAD, ETIQUETA_NIVEL } from "@/lib/formato";
import type { Modalidad, Nivel } from "@/types/dominio";

export const metadata: Metadata = { title: "Catálogo de cursos" };

const lista = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []);
const ORDENES: OrdenCatalogo[] = ["relevancia", "inicio", "precio-asc", "precio-desc"];

// HU-05 · Catálogo público · HU-33 · Búsqueda avanzada
export default async function CatalogoPage({ searchParams }: PageProps<"/cursos">) {
  const sp = await searchParams;
  const q = lista(sp.q)[0]?.trim() ?? "";
  const categorias = lista(sp.categoria);
  const niveles = lista(sp.nivel).filter((n): n is Nivel => n in ETIQUETA_NIVEL);
  const modalidades = lista(sp.modalidad).filter((m): m is Modalidad => m in ETIQUETA_MODALIDAD);
  const precio = Number(lista(sp.precio)[0]);
  const precioMax = Number.isFinite(precio) && precio > 0 && precio < PRECIO_TOPE ? precio : undefined;
  const ordenParam = lista(sp.orden)[0] as OrdenCatalogo;
  const orden = ORDENES.includes(ordenParam) ? ordenParam : "relevancia";

  const [cursos, todas, todosLosCursos] = await Promise.all([
    listarCursosPublicados({ q, categorias, niveles, modalidades, precioMax, orden }),
    listarCategorias(),
    listarCursosPublicados(),
  ]);

  const conteo: Record<string, number> = {};
  todosLosCursos.forEach((c) => c.categoria && (conteo[c.categoria.slug] = (conteo[c.categoria.slug] ?? 0) + 1));

  // Chips de filtros activos: cada uno enlaza a la URL sin ese filtro.
  const actual = new URLSearchParams();
  Object.entries(sp).forEach(([k, v]) => lista(v).forEach((x) => actual.append(k, x)));
  const sin = (clave: string, valor: string) => {
    const p = new URLSearchParams(actual);
    p.delete(clave, valor);
    const s = p.toString();
    return s ? `/cursos?${s}` : "/cursos";
  };
  const chips = [
    ...(q ? [{ k: "q", v: q, t: `“${q}”` }] : []),
    ...categorias.map((c) => ({ k: "categoria", v: c, t: todas.find((x) => x.slug === c)?.nombre ?? c })),
    ...niveles.map((n) => ({ k: "nivel", v: n, t: ETIQUETA_NIVEL[n] })),
    ...modalidades.map((m) => ({ k: "modalidad", v: m, t: ETIQUETA_MODALIDAD[m] })),
    ...(precioMax ? [{ k: "precio", v: String(precioMax), t: `Hasta S/ ${precioMax}` }] : []),
  ];

  return (
    <>
      <section className="relative overflow-hidden border-b bg-card">
        <div className="pointer-events-none absolute -top-32 -right-24 size-96 rounded-full bg-brand-300/20 blur-3xl dark:bg-brand-600/10" />
        <div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <nav aria-label="Ruta" className="animar-entrada flex items-center gap-1.5 text-sm text-muted-foreground">
            <Link href="/" className="transition-colors hover:text-foreground">
              Inicio
            </Link>
            <ChevronRightIcon className="size-3.5" aria-hidden />
            <span className="font-medium text-foreground">Cursos</span>
          </nav>
          <h1 className="animar-entrada mt-3 text-4xl font-bold tracking-tight [--i:1] sm:text-[2.5rem]">Catálogo de cursos</h1>
          <p className="animar-entrada mt-2 max-w-xl text-lg text-muted-foreground [--i:2]">
            Busca por nombre o instructor y filtra por categoría, nivel, modalidad y precio.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
        <FiltrosCatalogo
          valores={{ q, categorias, niveles, modalidades, precioMax: precioMax ?? PRECIO_TOPE, orden }}
          categorias={todas}
          conteoCategorias={conteo}
        >
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <p className="mr-2 text-sm text-muted-foreground" aria-live="polite">
              <b className="font-semibold text-foreground">{cursos.length}</b> curso{cursos.length === 1 ? "" : "s"} encontrado
              {cursos.length === 1 ? "" : "s"}
            </p>
            {chips.map((c) => (
              <Link
                key={`${c.k}-${c.v}`}
                href={sin(c.k, c.v)}
                scroll={false}
                className="animar-escala inline-flex items-center gap-1.5 rounded-full bg-brand-50 py-1 pr-2 pl-3 text-sm font-medium text-brand-800 ring-1 ring-brand-200 transition hover:bg-brand-100 dark:bg-brand-500/10 dark:text-brand-200 dark:ring-brand-500/30"
                aria-label={`Quitar filtro ${c.t}`}
              >
                {c.t}
                <XIcon className="size-3" />
              </Link>
            ))}
          </div>
          {cursos.length > 0 ? (
            <div className="escalonado mt-5 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {cursos.map((c) => (
                <CursoCard key={c.id} curso={c} />
              ))}
            </div>
          ) : (
            <EstadoVacio
              icono={SearchXIcon}
              titulo="No encontramos cursos con esos filtros"
              descripcion="Prueba con otra palabra o amplía el rango de precio."
              className="mt-5"
            >
              <Link href="/cursos" className={buttonVariants({ variant: "outline" })}>
                Limpiar filtros
              </Link>
            </EstadoVacio>
          )}
        </FiltrosCatalogo>
      </div>
    </>
  );
}
