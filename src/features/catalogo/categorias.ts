// HU-18 · Categorías jerárquicas: una categoría principal agrupa subcategorías
// (p. ej. «Tecnología e Informática» → «Programación», «Redes y servidores»…).
// Funciones puras: las usan el catálogo y la portada (servidor) y el panel de cursos.

export interface Categoria {
  id: number;
  nombre: string;
  slug: string;
  descripcion: string | null;
  padre_id: number | null;
}

type ConPadre = Pick<Categoria, "id" | "slug" | "padre_id">;

/** Los slugs indicados más los de todas sus subcategorías: filtrar por una principal incluye sus cursos. */
export function conSubcategorias(slugs: string[], categorias: ConPadre[]): string[] {
  const resultado = new Set(slugs);
  const pendientes = categorias.filter((c) => resultado.has(c.slug)).map((c) => c.id);
  const vistos = new Set<number>();
  while (pendientes.length) {
    const id = pendientes.pop()!;
    if (vistos.has(id)) continue;
    vistos.add(id);
    for (const hija of categorias) {
      if (hija.padre_id !== id) continue;
      resultado.add(hija.slug);
      pendientes.push(hija.id);
    }
  }
  return [...resultado];
}

/** Cursos por categoría; una principal suma los de sus subcategorías. */
export function contarCursosPorCategoria(
  cursos: { categoria: { slug: string } | null }[],
  categorias: ConPadre[],
): Record<string, number> {
  const directos: Record<string, number> = {};
  for (const c of cursos) if (c.categoria) directos[c.categoria.slug] = (directos[c.categoria.slug] ?? 0) + 1;
  return Object.fromEntries(
    categorias.map((c) => [c.slug, conSubcategorias([c.slug], categorias).reduce((s, slug) => s + (directos[slug] ?? 0), 0)]),
  );
}

/**
 * Orden de árbol: cada categoría principal seguida de sus subcategorías, con
 * su profundidad. Si la principal no está en la lista (p. ej. inactiva), la
 * subcategoría se muestra como principal.
 */
export function arbolDeCategorias<T extends ConPadre & { nombre: string }>(categorias: T[]): { categoria: T; nivel: number }[] {
  const ids = new Set(categorias.map((c) => c.id));
  const porNombre = (a: T, b: T) => a.nombre.localeCompare(b.nombre, "es");
  const resultado: { categoria: T; nivel: number }[] = [];
  const vistos = new Set<number>();
  const visitar = (c: T, nivel: number) => {
    if (vistos.has(c.id)) return;
    vistos.add(c.id);
    resultado.push({ categoria: c, nivel });
    categorias
      .filter((h) => h.padre_id === c.id)
      .sort(porNombre)
      .forEach((h) => visitar(h, nivel + 1));
  };
  categorias
    .filter((c) => c.padre_id === null || !ids.has(c.padre_id))
    .sort(porNombre)
    .forEach((c) => visitar(c, 0));
  return resultado;
}

/** Categorías sin subcategorías: las que agrupan cursos directamente (tarjetas de la portada). */
export function categoriasHoja<T extends ConPadre>(categorias: T[]): T[] {
  return categorias.filter((c) => !categorias.some((h) => h.padre_id === c.id));
}

/** Categorías que tienen subcategorías. */
export function categoriasPrincipales<T extends ConPadre>(categorias: T[]): T[] {
  return categorias.filter((c) => categorias.some((h) => h.padre_id === c.id));
}
