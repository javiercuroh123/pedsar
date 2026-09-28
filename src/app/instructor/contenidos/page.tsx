import type { Metadata } from "next";
import { CirclePlayIcon, FileTextIcon, FolderOpenIcon, LinkIcon, Trash2Icon } from "lucide-react";
import { BotonAccion } from "@/components/boton-accion";
import { EncabezadoPagina, EstadoVacio, Pildora } from "@/components/comunes";
import { SelectorUrl } from "@/components/selector-url";
import { eliminarContenido, eliminarModulo } from "@/features/academico/acciones-instructor";
import { listarModulosConContenidos } from "@/features/academico/consultas";
import { elegirCurso, listarCursosDelInstructor } from "@/features/academico/consultas-instructor";
import { DialogoContenido, DialogoModulo } from "@/features/academico/formularios-instructor";
import { requireRol } from "@/lib/auth";
import type { TipoContenido } from "@/types/dominio";

export const metadata: Metadata = { title: "Contenidos" };

const TIPO: Record<TipoContenido, { icono: typeof FileTextIcon; clase: string; etiqueta: string }> = {
  VIDEO: { icono: CirclePlayIcon, clase: "bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300", etiqueta: "Video" },
  PDF: { icono: FileTextIcon, clase: "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300", etiqueta: "PDF" },
  ENLACE: { icono: LinkIcon, clase: "bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300", etiqueta: "Enlace" },
};

// HU-08 · HU-52 · HU-55 · Contenidos por módulos
export default async function InstructorContenidosPage({ searchParams }: PageProps<"/instructor/contenidos">) {
  const usuario = await requireRol("instructor", "administrador");
  const { curso: param } = await searchParams;
  const cursos = await listarCursosDelInstructor(usuario);
  const curso = elegirCurso(cursos, param);
  const modulos = curso ? await listarModulosConContenidos(curso.id) : [];

  return (
    <div className="space-y-6">
      <EncabezadoPagina eyebrow="Docencia" titulo="Contenidos del curso" descripcion="Organiza materiales (PDF, videos y enlaces) por módulos.">
        {curso && (
          <>
            <SelectorUrl
              param="curso"
              valor={curso.id}
              etiqueta="Curso"
              opciones={cursos.map((c) => ({ valor: c.id, etiqueta: c.titulo }))}
              className="w-60"
            />
            <DialogoModulo cursoId={curso.id} />
            {modulos.length > 0 && <DialogoContenido cursoId={curso.id} modulos={modulos} />}
          </>
        )}
      </EncabezadoPagina>

      {!curso ? (
        <EstadoVacio icono={FolderOpenIcon} titulo="No tienes cursos asignados" descripcion="Cuando el administrador te asigne un curso podrás subir sus materiales." />
      ) : modulos.length === 0 ? (
        <EstadoVacio icono={FolderOpenIcon} titulo="Este curso aún no tiene módulos" descripcion="Crea el primer módulo para empezar a subir materiales.">
          <DialogoModulo cursoId={curso.id} />
        </EstadoVacio>
      ) : (
        <div className="space-y-4">
          {modulos.map((m, i) => (
            <section key={m.id} className="overflow-hidden rounded-2xl border bg-card shadow-xs">
              <div className="flex items-center gap-3 border-b bg-linear-to-r from-brand-50/80 to-transparent px-4 py-3 dark:from-brand-500/10">
                <span className="grid size-7 place-items-center rounded-lg bg-linear-to-br from-brand-500 to-violet-600 font-mono text-xs font-bold text-white">
                  {i + 1}
                </span>
                <h2 className="flex-1 text-sm font-semibold">{m.titulo}</h2>
                <span className="text-xs text-muted-foreground">{m.contenidos.length} elementos</span>
                <BotonAccion
                  accion={eliminarModulo}
                  campos={{ id: m.id }}
                  confirmar={`¿Eliminar el módulo "${m.titulo}" y todos sus contenidos?`}
                  variant="ghost"
                  size="icon-sm"
                  className="text-rose-600 dark:text-rose-400"
                  aria-label="Eliminar módulo"
                >
                  <Trash2Icon />
                </BotonAccion>
              </div>
              {m.contenidos.length ? (
                <ul className="divide-y">
                  {m.contenidos.map((c) => {
                    const t = TIPO[c.tipo];
                    return (
                      <li key={c.id} className="flex items-center gap-3 px-4 py-2.5">
                        <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${t.clase}`}>
                          <t.icono className="size-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{c.titulo}</p>
                          <p className="truncate text-xs text-muted-foreground">{c.url_archivo}</p>
                        </div>
                        <Pildora className="hidden sm:inline-flex">{t.etiqueta}</Pildora>
                        <BotonAccion
                          accion={eliminarContenido}
                          campos={{ id: c.id }}
                          confirmar={`¿Eliminar "${c.titulo}"?`}
                          variant="ghost"
                          size="icon-sm"
                          className="text-rose-600 dark:text-rose-400"
                          aria-label={`Eliminar ${c.titulo}`}
                        >
                          <Trash2Icon />
                        </BotonAccion>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">Sin materiales todavía.</p>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
