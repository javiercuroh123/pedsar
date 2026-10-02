import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleCheckIcon,
  CirclePlayIcon,
  ExternalLinkIcon,
  FileTextIcon,
  FolderOpenIcon,
  LinkIcon,
  MessagesSquareIcon,
} from "lucide-react";
import { BarraProgreso, EstadoVacio } from "@/components/comunes";
import { BotonEnviar } from "@/components/boton-enviar";
import { buttonVariants } from "@/components/ui/button";
import { marcarCompletado } from "@/features/academico/acciones-estudiante";
import { listarModulosConContenidos, type ContenidoAula } from "@/features/academico/consultas";
import { requireRol } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import type { TipoContenido } from "@/types/dominio";

export const metadata: Metadata = { title: "Aula virtual" };

const ICONO: Record<TipoContenido, typeof FileTextIcon> = { VIDEO: CirclePlayIcon, PDF: FileTextIcon, ENLACE: LinkIcon };

/** Convierte enlaces de YouTube / Vimeo a su versión embebible. */
function urlEmbebida(url: string) {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}`;
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return null;
}

/** Los archivos del bucket privado "contenidos" se sirven con URL firmada (1 h). */
async function resolverUrl(c: ContenidoAula) {
  if (/^https?:\/\//.test(c.url_archivo)) return c.url_archivo;
  const { data } = await createAdminClient().storage.from("contenidos").createSignedUrl(c.url_archivo, 3600);
  return data?.signedUrl ?? null;
}

// HU-08 · Aula virtual · HU-26 · HU-27 · HU-28
export default async function AulaPage({ params, searchParams }: PageProps<"/estudiante/cursos/[id]">) {
  const usuario = await requireRol("estudiante");
  const { id } = await params;
  const { c } = await searchParams;
  const supabase = await createClient();

  const { data: inscripcion } = await supabase
    .from("inscripciones")
    .select("id, estado, curso:cursos(id, titulo, descripcion)")
    .eq("curso_id", id)
    .eq("estudiante_id", usuario.id)
    .eq("estado", "CONFIRMADA")
    .maybeSingle();
  if (!inscripcion) notFound();
  const curso = (Array.isArray(inscripcion.curso) ? inscripcion.curso[0] : inscripcion.curso) as { id: string; titulo: string; descripcion: string | null };

  const [modulos, { data: completados }] = await Promise.all([
    listarModulosConContenidos(id),
    supabase.from("contenidos_completados").select("contenido_id").eq("inscripcion_id", inscripcion.id),
  ]);
  const hechos = new Set((completados ?? []).map((x: { contenido_id: number }) => x.contenido_id));
  const todos = modulos.flatMap((m, mi) => m.contenidos.map((ct, ci) => ({ ...ct, modulo: m.titulo, mi, ci })));
  const total = todos.length;
  const porcentaje = total ? Math.round((hechos.size / total) * 100) : 0;

  const indice = Math.max(
    0,
    todos.findIndex((t) => (c ? String(t.id) === c : !hechos.has(t.id))),
  );
  const actual = todos[indice];
  const anterior = todos[indice - 1];
  const siguiente = todos[indice + 1];
  const url = actual ? await resolverUrl(actual) : null;
  const embebida = actual?.tipo === "VIDEO" && url ? urlEmbebida(url) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground" aria-label="Ruta">
          <Link href="/estudiante/cursos" className="hover:text-foreground">
            Mis cursos
          </Link>
          <ChevronRightIcon className="size-3.5" />
          <span className="text-foreground">{curso.titulo}</span>
        </nav>
        {/* HU-19 · Consulta privada al instructor del curso */}
        <Link href={`/estudiante/mensajes/${id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
          <MessagesSquareIcon /> Escribir al instructor
        </Link>
      </div>

      {!actual ? (
        <EstadoVacio icono={FolderOpenIcon} titulo="Aún no hay contenidos publicados" descripcion="Tu instructor irá subiendo los materiales de cada módulo." />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0">
            <div className="relative aspect-video overflow-hidden rounded-2xl bg-zinc-950 text-white shadow-xl">
              {actual.tipo === "VIDEO" && embebida ? (
                <iframe
                  src={embebida}
                  title={actual.titulo}
                  className="absolute inset-0 size-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : actual.tipo === "VIDEO" && url ? (
                <video src={url} controls className="absolute inset-0 size-full bg-black" />
              ) : actual.tipo === "PDF" && url ? (
                <iframe src={url} title={actual.titulo} className="absolute inset-0 size-full bg-white" />
              ) : (
                <div className="absolute inset-0 grid place-items-center fondo-marca p-6 text-center">
                  <div className="fondo-puntos absolute inset-0 text-white/10" />
                  <div className="relative">
                    <LinkIcon className="flotar mx-auto size-10 text-brand-300" />
                    <p className="mt-3 text-lg font-semibold">{actual.titulo}</p>
                    {url && (
                      <a href={url} target="_blank" rel="noreferrer" className={buttonVariants({ className: "mt-4 bg-white text-brand-800 hover:bg-brand-50" })}>
                        Abrir recurso <ExternalLinkIcon />
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Módulo {actual.mi + 1} · {actual.modulo}
                </p>
                <h1 className="mt-1 text-xl font-bold tracking-tight">
                  {actual.mi + 1}.{actual.ci + 1} {actual.titulo}
                </h1>
              </div>
              <div className="flex gap-2">
                {anterior ? (
                  <Link href={`?c=${anterior.id}`} className={buttonVariants({ variant: "outline", size: "icon", className: "size-9" })} aria-label="Lección anterior">
                    <ChevronLeftIcon />
                  </Link>
                ) : null}
                {hechos.has(actual.id) ? (
                  <span className={buttonVariants({ variant: "secondary", className: "h-9 px-4" })}>
                    <CircleCheckIcon className="text-green-600" /> Completada
                  </span>
                ) : (
                  <form action={marcarCompletado}>
                    <input type="hidden" name="inscripcionId" value={inscripcion.id} />
                    <input type="hidden" name="contenidoId" value={actual.id} />
                    <input type="hidden" name="cursoId" value={id} />
                    <BotonEnviar className="h-9 px-4">
                      <CheckIcon /> Marcar como completada
                    </BotonEnviar>
                  </form>
                )}
                {siguiente ? (
                  <Link href={`?c=${siguiente.id}`} className={buttonVariants({ variant: "outline", size: "icon", className: "size-9" })} aria-label="Lección siguiente">
                    <ChevronRightIcon />
                  </Link>
                ) : null}
              </div>
            </div>

            {url && actual.tipo !== "ENLACE" && (
              <div className="mt-6 flex items-center gap-3 rounded-2xl border bg-card p-4">
                <span className="grid size-10 place-items-center rounded-xl bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300">
                  {actual.tipo === "PDF" ? <FileTextIcon className="size-5" /> : <CirclePlayIcon className="size-5" />}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium">{actual.titulo}</p>
                  <p className="text-xs text-muted-foreground">{actual.tipo === "PDF" ? "Documento PDF" : "Video"}</p>
                </div>
                <a href={url} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                  <ExternalLinkIcon /> Abrir
                </a>
              </div>
            )}
            {curso.descripcion && <p className="mt-6 max-w-3xl text-sm leading-relaxed text-muted-foreground">{curso.descripcion}</p>}
          </div>

          <aside className="h-fit overflow-hidden rounded-2xl border bg-card shadow-xs xl:sticky xl:top-24">
            <div className="border-b p-5">
              <p className="text-sm font-semibold">Contenido del curso</p>
              <div className="mt-3 flex items-center gap-3">
                <BarraProgreso valor={porcentaje} tono="turquesa" className="h-1.5" />
                <span className="font-mono text-xs">{porcentaje} %</span>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {hechos.size} de {total} lecciones completadas
              </p>
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              {modulos.map((m, mi) => (
                <details key={m.id} className="group border-b last:border-0" open={mi === actual.mi}>
                  <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3 hover:bg-muted/50">
                    <span className="flex-1 text-sm font-medium">
                      {mi + 1}. {m.titulo}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {m.contenidos.filter((x) => hechos.has(x.id)).length}/{m.contenidos.length}
                    </span>
                    <ChevronRightIcon className="size-4 text-muted-foreground transition group-open:rotate-90" />
                  </summary>
                  <ul className="pb-2">
                    {m.contenidos.map((ct, ci) => {
                      const Icono = ICONO[ct.tipo];
                      const hecho = hechos.has(ct.id);
                      const esActual = ct.id === actual.id;
                      return (
                        <li key={ct.id}>
                          <Link
                            href={`?c=${ct.id}`}
                            aria-current={esActual ? "true" : undefined}
                            className={cn(
                              "flex items-start gap-3 px-5 py-2.5 text-sm",
                              esActual ? "bg-brand-50 dark:bg-brand-500/10" : "hover:bg-muted/50",
                            )}
                          >
                            <span
                              className={cn(
                                "mt-0.5 grid size-4 shrink-0 place-items-center rounded-full",
                                hecho ? "bg-green-600 text-white" : "border border-input",
                              )}
                            >
                              {hecho && <CheckIcon className="size-2.5" />}
                            </span>
                            <span className={cn("flex-1", esActual && "font-semibold text-primary")}>
                              {mi + 1}.{ci + 1} {ct.titulo}
                            </span>
                            <Icono className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </details>
              ))}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
