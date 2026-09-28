import type { Metadata } from "next";
import Link from "next/link";
import { TagsIcon, Trash2Icon } from "lucide-react";
import { BotonAccion } from "@/components/boton-accion";
import { EncabezadoPagina, EstadoVacio } from "@/components/comunes";
import { eliminarCategoria } from "@/features/administracion/acciones";
import { DialogoCategoria } from "@/features/administracion/dialogos";
import { degradadoCategoria } from "@/features/catalogo/portada-curso";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Categorías" };

// HU-18 · Categorías del catálogo
export default async function AdminCategoriasPage() {
  await requireRol("administrador");
  const supabase = await createClient();
  const { data } = await supabase.from("categorias").select("id, nombre, slug, descripcion, cursos(count)").order("nombre");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const categorias = (data ?? []) as any[];

  return (
    <div className="space-y-6">
      <EncabezadoPagina eyebrow="Académico" titulo="Categorías" descripcion="Agrupan los cursos del catálogo público.">
        <DialogoCategoria />
      </EncabezadoPagina>
      {categorias.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {categorias.map((c) => {
            const n = c.cursos?.[0]?.count ?? 0;
            return (
              <div key={c.id} className="flex items-start gap-4 rounded-2xl border bg-card p-5 shadow-xs">
                <span className={cn("grid size-12 shrink-0 place-items-center rounded-xl bg-linear-to-br font-mono text-sm font-bold text-white shadow-sm", degradadoCategoria(c.slug))}>
                  {c.nombre.slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{c.nombre}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{c.descripcion ?? "Sin descripción"}</p>
                  <Link href={`/cursos?categoria=${c.slug}`} className="mt-3 inline-block text-xs font-medium text-primary hover:underline">
                    {n} curso{n === 1 ? "" : "s"} →
                  </Link>
                </div>
                <div className="flex">
                  <DialogoCategoria categoria={c} />
                  <BotonAccion
                    accion={eliminarCategoria}
                    campos={{ id: c.id }}
                    confirmar={`¿Eliminar "${c.nombre}"? Sus cursos quedarán sin categoría.`}
                    variant="ghost"
                    size="icon-sm"
                    className="text-rose-600 dark:text-rose-400"
                    aria-label="Eliminar categoría"
                  >
                    <Trash2Icon />
                  </BotonAccion>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EstadoVacio icono={TagsIcon} titulo="Aún no hay categorías" descripcion="Crea categorías para organizar el catálogo." />
      )}
    </div>
  );
}
