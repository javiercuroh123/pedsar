import type { Metadata } from "next";
import Form from "next/form";
import { ChartColumnIcon, FileSpreadsheetIcon, ClipboardListIcon, UsersIcon, WalletIcon } from "lucide-react";
import { BotonImprimir } from "@/components/boton-copiar";
import { BarraProgreso, EncabezadoPagina, EstadoVacio, PanelTabla, TarjetaKpi, tabla } from "@/components/comunes";
import { claseControl } from "@/components/dialogo-formulario";
import { Button, buttonVariants } from "@/components/ui/button";
import { rangoPorDefecto, reporteInscripciones } from "@/features/administracion/reportes";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ETIQUETA_METODO, ETIQUETA_MODALIDAD, formatearFecha, formatearSoles, hoyISO } from "@/lib/formato";
import { cn } from "@/lib/utils";
import type { MetodoPago } from "@/types/dominio";

export const metadata: Metadata = { title: "Reportes" };

const fecha = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

// HU-20 · HU-42 · Reportes de inscripciones e ingresos (Excel / PDF)
export default async function AdminReportesPage({ searchParams }: PageProps<"/admin/reportes">) {
  await requireRol("administrador");
  const sp = await searchParams;
  const def = rangoPorDefecto(hoyISO());
  const desde = fecha(sp.desde) ?? def.desde;
  const hasta = fecha(sp.hasta) ?? def.hasta;
  const curso = typeof sp.curso === "string" ? sp.curso : "";

  const supabase = await createClient();
  const [filas, { data: cursos }] = await Promise.all([
    reporteInscripciones(desde, hasta, curso || undefined),
    supabase.from("cursos").select("id, titulo").order("titulo"),
  ]);

  const total = filas.reduce((a, f) => a + f.ingresos, 0);
  const inscritos = filas.reduce((a, f) => a + f.inscritos, 0);
  const confirmados = filas.reduce((a, f) => a + f.confirmados, 0);
  const porMetodo = (Object.keys(ETIQUETA_METODO) as MetodoPago[])
    .map((m) => ({ m, v: filas.reduce((a, f) => a + (f.porMetodo[m] ?? 0), 0) }))
    .filter((x) => x.v > 0)
    .sort((a, b) => b.v - a.v);
  const exportar = `/admin/reportes/exportar?${new URLSearchParams({ desde, hasta, ...(curso && { curso }) })}`;

  return (
    <div className="space-y-6">
      <EncabezadoPagina eyebrow="General" titulo="Reportes" descripcion={`Inscripciones e ingresos del ${formatearFecha(desde)} al ${formatearFecha(hasta)}.`}>
        <div className="flex gap-2 print:hidden">
          <a href={exportar} className={buttonVariants({ variant: "outline" })}>
            <FileSpreadsheetIcon /> Excel
          </a>
          <BotonImprimir>PDF</BotonImprimir>
        </div>
      </EncabezadoPagina>

      <Form action="/admin/reportes" className="grid gap-3 rounded-2xl border bg-card p-4 shadow-xs sm:grid-cols-[1fr_1fr_2fr_auto] sm:items-end print:hidden">
        <label className="space-y-1.5 text-sm font-medium">
          Desde
          <input type="date" name="desde" defaultValue={desde} className={cn(claseControl, "h-9")} />
        </label>
        <label className="space-y-1.5 text-sm font-medium">
          Hasta
          <input type="date" name="hasta" defaultValue={hasta} className={cn(claseControl, "h-9")} />
        </label>
        <label className="space-y-1.5 text-sm font-medium">
          Curso
          <select name="curso" defaultValue={curso} className={cn(claseControl, "h-9")}>
            <option value="">Todos los cursos</option>
            {(cursos ?? []).map((c: { id: string; titulo: string }) => (
              <option key={c.id} value={c.id}>
                {c.titulo}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" className="h-9">
          Generar
        </Button>
      </Form>

      <div className="grid gap-4 sm:grid-cols-3">
        <TarjetaKpi etiqueta="Inscripciones" valor={inscritos} icono={ClipboardListIcon} tono="indigo" />
        <TarjetaKpi etiqueta="Confirmadas" valor={confirmados} icono={UsersIcon} tono="turquesa" detalle={inscritos ? `${Math.round((confirmados / inscritos) * 100)} % del total` : undefined} />
        <TarjetaKpi etiqueta="Ingresos aprobados" valor={formatearSoles(total)} icono={WalletIcon} tono="coral" />
      </div>

      {filas.length ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <PanelTabla titulo="Inscripciones por curso" className="lg:col-span-2">
            <table className={tabla.table}>
              <thead className={tabla.thead}>
                <tr>
                  <th className={tabla.th}>Curso</th>
                  <th className={tabla.th}>Modalidad</th>
                  <th className={cn(tabla.th, "text-right")}>Inscritos</th>
                  <th className={tabla.th}>Ocupación</th>
                  <th className={cn(tabla.th, "text-right")}>Ingresos</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => {
                  const p = Math.round((f.inscritos / f.cupo) * 100);
                  return (
                    <tr key={f.cursoId} className={tabla.tr}>
                      <td className={cn(tabla.td, "font-medium")}>{f.titulo}</td>
                      <td className={cn(tabla.td, "text-muted-foreground")}>{ETIQUETA_MODALIDAD[f.modalidad]}</td>
                      <td className={cn(tabla.td, "text-right font-mono")}>{f.inscritos}</td>
                      <td className={tabla.td}>
                        <div className="flex items-center gap-2">
                          <BarraProgreso valor={p} className="h-1.5 w-24" tono={p >= 100 ? "rojo" : "indigo"} />
                          <span className="font-mono text-xs">{p}%</span>
                        </div>
                      </td>
                      <td className={cn(tabla.td, "text-right tabular-nums")}>{formatearSoles(f.ingresos)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </PanelTabla>
          <section className="rounded-2xl border bg-card p-5 shadow-xs">
            <h2 className="font-semibold">Ingresos por método de pago</h2>
            {porMetodo.length ? (
              <ul className="mt-5 space-y-4">
                {porMetodo.map(({ m, v }) => (
                  <li key={m}>
                    <div className="flex justify-between text-sm">
                      <span>{ETIQUETA_METODO[m]}</span>
                      <span className="font-mono text-xs text-muted-foreground">{formatearSoles(v)}</span>
                    </div>
                    <BarraProgreso valor={(v / total) * 100} tono="turquesa" className="mt-1.5 h-1.5" etiqueta={ETIQUETA_METODO[m]} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-5 text-sm text-muted-foreground">Sin pagos aprobados en el periodo.</p>
            )}
          </section>
        </div>
      ) : (
        <EstadoVacio icono={ChartColumnIcon} titulo="Sin inscripciones en el periodo" descripcion="Amplía el rango de fechas o elige otro curso." />
      )}
    </div>
  );
}
