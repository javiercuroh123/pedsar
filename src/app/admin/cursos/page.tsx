import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { CopyIcon, EyeIcon, EyeOffIcon, LibraryIcon, SearchIcon, StarIcon, Trash2Icon } from "lucide-react";
import { BotonAccion } from "@/components/boton-accion";
import { EncabezadoPagina, EstadoBadge, EstadoVacio, PanelTabla, tabla } from "@/components/comunes";
import { Input } from "@/components/ui/input";
import { uno } from "@/features/academico/consultas";
import { cambiarEstadoCurso, duplicarCurso, eliminarCurso } from "@/features/administracion/acciones";
import { DialogoCurso, type CursoEditable } from "@/features/administracion/dialogo-curso";
import { ICONO_MODALIDAD, SiglaCurso } from "@/features/catalogo/portada-curso";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ETIQUETA_MODALIDAD, formatearSoles, nombreCompleto } from "@/lib/formato";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Cursos" };

const FILTROS = [
  { v: "", t: "Todos" },
  { v: "PUBLICADO", t: "Publicados" },
  { v: "BORRADOR", t: "Borradores" },
  { v: "DESPUBLICADO", t: "Despublicados" },
];

// HU-04 · HU-56 · HU-57 · Gestión de cursos
export default async function AdminCursosPage({ searchParams }: PageProps<"/admin/cursos">) {
  await requireRol("administrador");
  const { q, estado } = await searchParams;
  const texto = typeof q === "string" ? q.trim() : "";
  const filtro = typeof estado === "string" ? estado : "";
  const supabase = await createClient();

  let consulta = supabase
    .from("cursos")
    .select(
      "id, slug, titulo, descripcion, categoria_id, instructor_id, nivel, modalidad, precio, cupo_maximo, duracion_horas, estado, destacado, publicar_en, imagen_url, categoria:categorias(nombre, slug), inscripciones(count)",
    )
    .order("creado_en", { ascending: false });
  if (filtro) consulta = consulta.eq("estado", filtro);
  if (texto) consulta = consulta.ilike("titulo", `%${texto}%`);

  const [{ data }, { data: categorias }, { data: instructores }] = await Promise.all([
    consulta,
    supabase.from("categorias").select("id, nombre").order("nombre"),
    supabase.from("perfiles").select("id, nombres, apellidos, correo").eq("rol", "instructor").order("nombres"),
  ]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cursos = (data ?? []) as any[];
  const listaInstructores = (instructores ?? []).map((i: { id: string; nombres: string; apellidos: string; correo: string }) => ({
    id: i.id,
    nombre: nombreCompleto(i) || i.correo,
  }));
  const nombreInstructor = (id: string | null) => listaInstructores.find((i) => i.id === id)?.nombre ?? "Sin instructor";

  return (
    <div className="space-y-6">
      <EncabezadoPagina eyebrow="Académico" titulo="Gestión de cursos" descripcion="Crea, edita, publica, despublica, duplica o elimina cursos.">
        <DialogoCurso categorias={categorias ?? []} instructores={listaInstructores} />
      </EncabezadoPagina>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <Form action="/admin/cursos" className="relative flex-1">
          {filtro && <input type="hidden" name="estado" value={filtro} />}
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" type="search" defaultValue={texto} placeholder="Buscar curso y presionar Enter" className="h-9 bg-card pl-9" aria-label="Buscar curso" />
        </Form>
        <div className="inline-flex overflow-x-auto rounded-lg bg-muted p-1 text-sm">
          {FILTROS.map((f) => {
            const p = new URLSearchParams({ ...(texto && { q: texto }), ...(f.v && { estado: f.v }) });
            return (
              <Link
                key={f.v}
                href={`/admin/cursos${p.size ? `?${p}` : ""}`}
                className={cn("rounded-md px-3 py-1.5 font-medium whitespace-nowrap", filtro === f.v ? "bg-background shadow-sm" : "text-muted-foreground")}
              >
                {f.t}
              </Link>
            );
          })}
        </div>
      </div>

      {cursos.length ? (
        <PanelTabla>
          <table className={cn(tabla.table, "min-w-240")}>
            <thead className={tabla.thead}>
              <tr>
                <th className={tabla.th}>Curso</th>
                <th className={tabla.th}>Categoría</th>
                <th className={tabla.th}>Modalidad</th>
                <th className={tabla.th}>Inscritos</th>
                <th className={cn(tabla.th, "text-right")}>Precio</th>
                <th className={tabla.th}>Estado</th>
                <th className={cn(tabla.th, "text-right")}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cursos.map((c) => {
                const cat = uno<{ nombre: string; slug: string }>(c.categoria);
                const Icono = ICONO_MODALIDAD[c.modalidad as keyof typeof ICONO_MODALIDAD];
                const publicado = c.estado === "PUBLICADO";
                const editable: CursoEditable = { ...c, precio: Number(c.precio) };
                return (
                  <tr key={c.id} className={tabla.tr}>
                    <td className={tabla.td}>
                      <div className="flex items-center gap-3">
                        <SiglaCurso titulo={c.titulo} categoria={cat?.slug} className="size-10 text-xs" />
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 font-medium">
                            {c.titulo}
                            {c.destacado && <StarIcon className="size-3.5 fill-amber-400 text-amber-400" aria-label="Destacado" />}
                          </p>
                          <p className="text-xs text-muted-foreground">{nombreInstructor(c.instructor_id)}</p>
                        </div>
                      </div>
                    </td>
                    <td className={cn(tabla.td, "text-muted-foreground")}>{cat?.nombre ?? "—"}</td>
                    <td className={tabla.td}>
                      <span className="inline-flex items-center gap-1.5">
                        <Icono className="size-3.5 text-muted-foreground" />
                        {ETIQUETA_MODALIDAD[c.modalidad as keyof typeof ETIQUETA_MODALIDAD]}
                      </span>
                    </td>
                    <td className={cn(tabla.td, "font-mono text-xs")}>
                      {uno<{ count: number }>(c.inscripciones)?.count ?? 0}/{c.cupo_maximo}
                    </td>
                    <td className={cn(tabla.td, "text-right tabular-nums")}>{formatearSoles(Number(c.precio))}</td>
                    <td className={tabla.td}>
                      <EstadoBadge estado={c.estado} />
                    </td>
                    <td className={tabla.td}>
                      <div className="flex justify-end gap-0.5">
                        <DialogoCurso curso={editable} categorias={categorias ?? []} instructores={listaInstructores} />
                        <BotonAccion
                          accion={cambiarEstadoCurso}
                          campos={{ id: c.id, estado: publicado ? "DESPUBLICADO" : "PUBLICADO" }}
                          variant="ghost"
                          size="icon-sm"
                          aria-label={publicado ? "Despublicar" : "Publicar"}
                          title={publicado ? "Despublicar" : "Publicar"}
                        >
                          {publicado ? <EyeOffIcon /> : <EyeIcon />}
                        </BotonAccion>
                        <BotonAccion accion={duplicarCurso} campos={{ id: c.id }} variant="ghost" size="icon-sm" aria-label="Duplicar" title="Duplicar">
                          <CopyIcon />
                        </BotonAccion>
                        <BotonAccion
                          accion={eliminarCurso}
                          campos={{ id: c.id }}
                          confirmar={`¿Eliminar "${c.titulo}"? Esta acción no se puede deshacer.`}
                          variant="ghost"
                          size="icon-sm"
                          className="text-red-600 dark:text-red-400"
                          aria-label="Eliminar"
                          title="Eliminar"
                        >
                          <Trash2Icon />
                        </BotonAccion>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </PanelTabla>
      ) : (
        <EstadoVacio icono={LibraryIcon} titulo={texto || filtro ? "No hay cursos con este filtro" : "Aún no hay cursos"} descripcion="Crea el primer curso con el botón «Nuevo curso»." />
      )}
    </div>
  );
}
