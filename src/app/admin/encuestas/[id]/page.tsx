import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, CopyIcon, DownloadIcon, LockIcon, MessageSquareTextIcon, PercentIcon, SendIcon, SmileIcon, Trash2Icon } from "lucide-react";
import { BarraProgreso, EncabezadoPagina, EstadoVacio, PanelTabla, Pildora, TarjetaKpi, tabla } from "@/components/comunes";
import { BotonAccion } from "@/components/boton-accion";
import { SelectorUrl } from "@/components/selector-url";
import { buttonVariants } from "@/components/ui/button";
import { formatearPromedio } from "@/features/comunidad/estrellas";
import { activarEncuesta, duplicarEncuesta, eliminarEncuesta, eliminarPregunta } from "@/features/encuestas/acciones";
import { obtenerEncuestaAdmin, resultadosDeEncuesta } from "@/features/encuestas/consultas";
import { DialogoEditarEncuesta, DialogoPregunta } from "@/features/encuestas/dialogos-admin";
import { ETIQUETA_ASPECTO } from "@/features/encuestas/resultados";
import { requireRol } from "@/lib/auth";
import { formatearFechaHora } from "@/lib/formato";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Encuesta" };

const nota = (n: number | null) => (n === null ? "—" : `${formatearPromedio(n)} / 5`);
const pct = (n: number | null) => (n === null ? "—" : `${Math.round(n)} %`);

// HU-43 · Una encuesta: sus preguntas (editables hasta el primer envío) y sus resultados
export default async function AdminEncuestaPage({ params, searchParams }: PageProps<"/admin/encuestas/[id]">) {
  await requireRol("administrador");
  const [{ id }, { curso }] = await Promise.all([params, searchParams]);
  const encuestaId = Number(id);
  const encuesta = Number.isInteger(encuestaId) && encuestaId > 0 ? await obtenerEncuestaAdmin(encuestaId) : null;
  if (!encuesta) notFound();

  // Los cursos del filtro salen de todos los envíos; los resultados, del curso elegido.
  const todos = await resultadosDeEncuesta(encuesta.id, encuesta.preguntas);
  const cursos = todos.resultados.porCurso;
  const cursoId = typeof curso === "string" && cursos.some((c) => c.cursoId === curso) ? curso : undefined;
  const { resultados: r } = cursoId ? await resultadosDeEncuesta(encuesta.id, encuesta.preguntas, cursoId) : todos;
  const exportar = `/admin/encuestas/${encuesta.id}/exportar${cursoId ? `?curso=${cursoId}` : ""}`;

  return (
    <div className="space-y-6">
      <Link href="/admin/encuestas" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> Encuestas
      </Link>
      <EncabezadoPagina
        eyebrow="Encuesta de satisfacción"
        titulo={encuesta.titulo}
        descripcion={
          encuesta.activa
            ? "Activa: se envía a cada estudiante cuando recibe su certificado."
            : encuesta.bloqueada
              ? "Cerrada: ya no se envía, pero conserva sus resultados."
              : "Borrador: agrega sus preguntas y actívala para empezar a enviarla."
        }
      >
        <DialogoEditarEncuesta id={encuesta.id} titulo={encuesta.titulo} descripcion={encuesta.descripcion} />
        <BotonAccion accion={duplicarEncuesta} campos={{ id: encuesta.id }} variant="outline">
          <CopyIcon /> Duplicar
        </BotonAccion>
        {!encuesta.bloqueada && (
          <BotonAccion accion={eliminarEncuesta} campos={{ id: encuesta.id }} variant="ghost" confirmar="¿Eliminar esta encuesta? Aún no se ha enviado a nadie.">
            <Trash2Icon /> Eliminar
          </BotonAccion>
        )}
        <BotonAccion
          accion={activarEncuesta}
          campos={{ id: encuesta.id, activa: String(!encuesta.activa) }}
          variant={encuesta.activa ? "outline" : "default"}
          confirmar={
            encuesta.activa
              ? "¿Desactivar la encuesta? Los estudiantes que terminen un curso dejarán de recibirla."
              : "¿Activar esta encuesta? Reemplaza a la vigente y se enviará a cada estudiante que reciba su certificado."
          }
        >
          {encuesta.activa ? "Desactivar" : "Activar"}
        </BotonAccion>
      </EncabezadoPagina>

      {/* ---------- Preguntas ---------- */}
      <PanelTabla
        titulo={`Preguntas (${encuesta.preguntas.length})`}
        accion={
          encuesta.bloqueada ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <LockIcon className="size-3.5" /> Bloqueadas tras el primer envío · duplica la encuesta para cambiarlas
            </span>
          ) : (
            <DialogoPregunta encuestaId={encuesta.id} />
          )
        }
      >
        {encuesta.preguntas.length ? (
          <ol className="divide-y">
            {encuesta.preguntas.map((p, i) => (
              <li key={p.id} className="flex items-center gap-4 px-5 py-3">
                <span className="w-5 shrink-0 text-sm font-semibold text-muted-foreground tabular-nums">{i + 1}.</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{p.enunciado}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {p.tipo === "ESCALA" ? `Escala 1 a 5 · ${ETIQUETA_ASPECTO[p.aspecto!]}` : "Respuesta abierta"}
                    {p.obligatoria ? "" : " · opcional"}
                  </p>
                </div>
                {!encuesta.bloqueada && (
                  <BotonAccion accion={eliminarPregunta} campos={{ id: p.id, encuestaId: encuesta.id }} variant="ghost" size="sm" aria-label={`Eliminar la pregunta ${i + 1}`}>
                    <Trash2Icon />
                  </BotonAccion>
                )}
              </li>
            ))}
          </ol>
        ) : (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">Agrega al menos una pregunta de escala para poder activarla.</p>
        )}
      </PanelTabla>

      {/* ---------- Resultados ---------- */}
      <div className="flex flex-wrap items-end justify-between gap-3 pt-2">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Resultados</h2>
          <p className="text-sm text-muted-foreground">Las respuestas se muestran sin el nombre del estudiante.</p>
        </div>
        {todos.resultados.enviadas > 0 && (
          <div className="flex flex-wrap gap-2">
            {cursos.length > 1 && (
              <SelectorUrl
                param="curso"
                valor={cursoId ?? ""}
                etiqueta="Curso"
                opciones={[{ valor: "", etiqueta: "Todos los cursos" }, ...cursos.map((c) => ({ valor: c.cursoId, etiqueta: c.curso }))]}
                className="w-60"
              />
            )}
            {r.respondidas > 0 && (
              <a href={exportar} className={buttonVariants({ variant: "outline" })}>
                <DownloadIcon /> Exportar Excel
              </a>
            )}
          </div>
        )}
      </div>

      {r.enviadas === 0 ? (
        <EstadoVacio
          icono={SendIcon}
          titulo="Aún no se ha enviado"
          descripcion={encuesta.activa ? "Se enviará cuando el próximo estudiante reciba su certificado." : "Actívala para que se envíe al terminar cada curso."}
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <TarjetaKpi etiqueta="Enviadas" valor={r.enviadas} icono={SendIcon} tono="indigo" detalle="Al emitirse el certificado" />
            <TarjetaKpi etiqueta="Tasa de respuesta" valor={pct(r.tasaRespuesta)} icono={PercentIcon} tono="cielo" detalle={`${r.respondidas} respondidas`} />
            <TarjetaKpi etiqueta="Índice de satisfacción" valor={nota(r.indice)} icono={SmileIcon} tono="turquesa" detalle="Promedio de las preguntas de escala" />
            <TarjetaKpi etiqueta="Satisfechos" valor={pct(r.satisfechos)} icono={MessageSquareTextIcon} tono="ambar" detalle="Respuestas con 4 o 5" />
          </div>

          {r.respondidas > 0 && (
            <>
              <div className="grid gap-6 lg:grid-cols-3">
                <section className="rounded-2xl border bg-card p-5 shadow-xs">
                  <h3 className="font-semibold">Promedio por aspecto</h3>
                  <ul className="mt-4 space-y-4">
                    {r.porAspecto.map((a) => (
                      <li key={a.aspecto}>
                        <div className="flex items-baseline justify-between text-sm">
                          <span>{ETIQUETA_ASPECTO[a.aspecto]}</span>
                          <span className="font-semibold tabular-nums">{nota(a.promedio)}</span>
                        </div>
                        <BarraProgreso valor={a.promedio ? (a.promedio / 5) * 100 : 0} className="mt-1.5 h-2" tono="turquesa" etiqueta={`${ETIQUETA_ASPECTO[a.aspecto]}: ${nota(a.promedio)}`} />
                      </li>
                    ))}
                  </ul>
                </section>

                <PanelTabla className="lg:col-span-2" titulo="Por pregunta">
                  <table className={cn(tabla.table, "min-w-150")}>
                    <thead className={tabla.thead}>
                      <tr>
                        <th className={tabla.th}>Pregunta</th>
                        <th className={cn(tabla.th, "text-right")}>Promedio</th>
                        <th className={cn(tabla.th, "text-right")}>Satisfechos</th>
                        <th className={tabla.th}>Distribución (1 → 5)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.porPregunta
                        .filter((p) => p.pregunta.tipo === "ESCALA")
                        .map((p) => {
                          const max = Math.max(1, ...p.distribucion);
                          return (
                            <tr key={p.pregunta.id} className={tabla.tr}>
                              <td className={cn(tabla.td, "max-w-xs text-sm")}>{p.pregunta.enunciado}</td>
                              <td className={cn(tabla.td, "text-right font-semibold tabular-nums whitespace-nowrap")}>{nota(p.promedio)}</td>
                              <td className={cn(tabla.td, "text-right tabular-nums")}>{pct(p.satisfechos)}</td>
                              <td className={tabla.td}>
                                <div className="flex h-8 items-end gap-1" role="img" aria-label={`Respuestas del 1 al 5: ${p.distribucion.join(", ")}`}>
                                  {p.distribucion.map((n, i) => (
                                    <span key={i} title={`${i + 1}: ${n}`} className={cn("w-4 rounded-sm", i >= 3 ? "bg-green-500" : i === 2 ? "bg-amber-400" : "bg-red-400")} style={{ height: `${Math.max(8, (n / max) * 100)}%`, opacity: n ? 1 : 0.25 }} />
                                  ))}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </PanelTabla>
              </div>

              {!cursoId && cursos.length > 0 && (
                <PanelTabla titulo="Por curso">
                  <table className={cn(tabla.table, "min-w-180")}>
                    <thead className={tabla.thead}>
                      <tr>
                        <th className={tabla.th}>Curso</th>
                        <th className={cn(tabla.th, "text-right")}>Respondidas</th>
                        {r.porAspecto.map((a) => (
                          <th key={a.aspecto} className={cn(tabla.th, "text-right")}>
                            {ETIQUETA_ASPECTO[a.aspecto]}
                          </th>
                        ))}
                        <th className={cn(tabla.th, "text-right")}>Índice</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cursos.map((c) => (
                        <tr key={c.cursoId} className={tabla.tr}>
                          <td className={tabla.td}>
                            <Link href={`/admin/encuestas/${encuesta.id}?curso=${c.cursoId}`} className="font-medium hover:text-primary hover:underline">
                              {c.curso}
                            </Link>
                          </td>
                          <td className={cn(tabla.td, "text-right tabular-nums")}>
                            {c.respondidas} de {c.enviadas}
                          </td>
                          {r.porAspecto.map((a) => (
                            <td key={a.aspecto} className={cn(tabla.td, "text-right tabular-nums")}>
                              {c.porAspecto[a.aspecto] !== undefined ? formatearPromedio(c.porAspecto[a.aspecto]!) : "—"}
                            </td>
                          ))}
                          <td className={cn(tabla.td, "text-right font-semibold tabular-nums")}>{c.general === null ? "—" : formatearPromedio(c.general)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </PanelTabla>
              )}

              <section className="rounded-2xl border bg-card shadow-xs">
                <div className="flex items-center justify-between border-b px-5 py-4">
                  <h3 className="font-semibold">Comentarios</h3>
                  <Pildora color="gris">{r.comentarios.length}</Pildora>
                </div>
                {r.comentarios.length ? (
                  <ul className="divide-y">
                    {r.comentarios.map((c, i) => (
                      <li key={i} className="px-5 py-4">
                        <p className="text-sm leading-relaxed break-words whitespace-pre-line">«{c.texto}»</p>
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          {c.curso} · {c.pregunta} · {formatearFechaHora(c.fecha)}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-5 py-8 text-center text-sm text-muted-foreground">Sin comentarios todavía.</p>
                )}
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}
