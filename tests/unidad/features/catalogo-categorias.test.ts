import { describe, expect, it } from "vitest";
import {
  arbolDeCategorias,
  categoriasHoja,
  categoriasPrincipales,
  conSubcategorias,
  contarCursosPorCategoria,
  type Categoria,
} from "@/features/catalogo/categorias";

const cat = (id: number, slug: string, padre_id: number | null = null): Categoria => ({
  id,
  slug,
  nombre: slug.charAt(0).toUpperCase() + slug.slice(1),
  descripcion: null,
  padre_id,
});

// «tecnologia» → «programacion», «redes» → «redes-cisco» (dos niveles) y «gestion» suelta.
const categorias = [cat(1, "tecnologia"), cat(2, "redes", 1), cat(3, "programacion", 1), cat(4, "redes-cisco", 2), cat(5, "gestion")];

describe("categorías jerárquicas (HU-18)", () => {
  it("filtrar por una categoría principal incluye todas sus subcategorías", () => {
    expect(conSubcategorias(["tecnologia"], categorias).sort()).toEqual(["programacion", "redes", "redes-cisco", "tecnologia"]);
    expect(conSubcategorias(["redes"], categorias).sort()).toEqual(["redes", "redes-cisco"]);
    expect(conSubcategorias(["gestion", "programacion"], categorias).sort()).toEqual(["gestion", "programacion"]);
    // Un slug desconocido se conserva (el filtro simplemente no encuentra cursos).
    expect(conSubcategorias(["no-existe"], categorias)).toEqual(["no-existe"]);
  });

  it("no se cuelga si los datos traen un ciclo", () => {
    const ciclo = [cat(1, "a", 2), cat(2, "b", 1)];
    expect(conSubcategorias(["a"], ciclo).sort()).toEqual(["a", "b"]);
  });

  it("la principal suma los cursos de sus subcategorías", () => {
    const cursos = [
      { categoria: { slug: "programacion" } },
      { categoria: { slug: "programacion" } },
      { categoria: { slug: "redes-cisco" } },
      { categoria: { slug: "tecnologia" } },
      { categoria: null },
    ];
    expect(contarCursosPorCategoria(cursos, categorias)).toEqual({
      tecnologia: 4,
      redes: 1,
      programacion: 2,
      "redes-cisco": 1,
      gestion: 0,
    });
  });

  it("ordena en árbol: cada principal seguida de sus subcategorías por nombre", () => {
    expect(arbolDeCategorias(categorias).map(({ categoria, nivel }) => [categoria.slug, nivel])).toEqual([
      ["gestion", 0],
      ["tecnologia", 0],
      ["programacion", 1],
      ["redes", 1],
      ["redes-cisco", 2],
    ]);
  });

  it("una subcategoría cuya principal no está en la lista (inactiva) se muestra como principal", () => {
    const sinPadre = categorias.filter((c) => c.slug !== "tecnologia");
    expect(arbolDeCategorias(sinPadre).map(({ categoria, nivel }) => [categoria.slug, nivel])).toEqual([
      ["gestion", 0],
      ["programacion", 0],
      ["redes", 0],
      ["redes-cisco", 1],
    ]);
  });

  it("distingue las hojas (tarjetas de la portada) de las principales", () => {
    expect(categoriasHoja(categorias).map((c) => c.slug)).toEqual(["programacion", "redes-cisco", "gestion"]);
    expect(categoriasPrincipales(categorias).map((c) => c.slug)).toEqual(["tecnologia", "redes"]);
  });
});
