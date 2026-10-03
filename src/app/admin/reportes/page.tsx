import type { Metadata } from "next";
import Form from "next/form";
import { ChartColumnIcon, ClipboardListIcon, FileSpreadsheetIcon, FileTextIcon, UserPlusIcon, UsersIcon, WalletIcon } from "lucide-react";
import { BarraProgreso, EncabezadoPagina, EstadoVacio, PanelTabla, TarjetaKpi, tabla } from "@/components/comunes";
import { claseControl } from "@/components/dialogo-formulario";
import { Button, buttonVariants } from "@/components/ui/button";
import { etiquetaMes, generarReporte, rangoPorDefecto } from "@/features/administracion/reportes";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ETIQUETA_MODALIDAD, formatearFecha, formatearSoles, hoyISO } from "@/lib/formato";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Reportes" };

const fecha = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// HU-20 · RF-10 · Reportes de usuarios, inscripciones e ingresos con exportación a Excel y PDF
export default async function AdminReportesPage({ searchParams }: PageProps<"/admin/reportes">) {
  await requireRol("administrador");
  const sp = await searchParams;
  const def = rangoPorDefecto(hoyISO());
  const desde = fecha(sp.desde) ?? def.desde;
  const hasta = fecha(sp.hasta) ?? def.hasta;
  const curso = typeof sp.curso === "string" && UUID.test(sp.curso) ? sp.curso : "";

  const supabase = await createClient();
  const [r, { data: cursos }] = await Promise.all([
    generarReporte(desde, hasta, curso || undefined),
    supabase.from("cursos").select("id, titulo").order("titulo"),
  ]);
  const { totales: t, usuarios: u } = r;
  const parametros = new URLSearchParams({ desde, hasta, ...(curso && { curso }) });
  const exportar = (formato: "xlsx" | "pdf") => `/admin/reportes/exportar?${parametros}&formato=${formato}`;

  return (
    <div className="space-y-6">
      <EncabezadoPagina eyebrow="General" titulo="Reportes" descripcion={`Usuarios, inscripciones e ingresos del ${formatearFecha(desde)} al ${formatearFecha(hasta)}.`}>
        <div className="flex gap-2">
          <a href={exportar("xlsx")} className={buttonVariants({ variant: "outline" })}>
            <FileSpreadsheetIcon /> Excel
          </a>
          <a href={exportar("pdf")} className={buttonVariants({ variant: "outline" })}>
            <FileTextIcon /> PDF
          </a>
        </div>
      </EncabezadoPagina>

      <Form action="/admin/reportes" className="grid gap-3 rounded-2xl border bg-card p-4 shadow-xs sm:grid-cols-[1fr_1fr_2fr_auto] sm:items-end">
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
            {(cursos ?? []).map((c) => (
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

      <div className="escalonado grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <TarjetaKpi etiqueta="Inscripciones" valor={t.inscritos} icono={ClipboardListIcon} tono="indigo" />
        <TarjetaKpi
          etiqueta="Confirmadas"
          valor={t.confirmados}
          icono={UsersIcon}
          tono="turquesa"
          detalle={t.inscritos ? `${Math.round((t.confirmados / t.inscritos) * 100)} % del total` : undefined}
        />
        <TarjetaKpi etiqueta="Ingresos aprobados" valor={formatearSoles(t.ingresos)} icono={WalletIcon} tono="coral" />
        <TarjetaKpi etiqueta="Usuarios nuevos" valor={u.nuevos} icono={UserPlusIcon} tono="ambar" detalle={`${u.registrados} registrados · ${u.activos} activos`} />
      </div>

      {r.porCurso.length ? (
        <>
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
                  {r.porCurso.map((f) => {
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
              {r.porMetodo.length ? (
                <ul className="mt-5 space-y-4">
                  {r.porMetodo.map(({ metodo, monto }) => (
                    <li key={metodo}>
                      <div className="flex justify-between text-sm">
                        <span>{metodo}</span>
                        <span className="font-mono text-xs text-muted-foreground">{formatearSoles(monto)}</span>
                      </div>
                      <BarraProgreso valor={(monto / t.ingresos) * 100} tono="turquesa" className="mt-1.5 h-1.5" etiqueta={metodo} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-5 text-sm text-muted-foreground">Sin pagos aprobados en el periodo.</p>
              )}
            </section>
          </div>
          <PanelTabla titulo="Evolución mensual">
            <table className={tabla.table}>
              <thead className={tabla.thead}>
                <tr>
                  <th className={tabla.th}>Mes</th>
                  <th className={cn(tabla.th, "text-right")}>Inscripciones</th>
                  <th className={cn(tabla.th, "text-right")}>Confirmadas</th>
                  <th className={cn(tabla.th, "text-right")}>Ingresos</th>
                </tr>
              </thead>
              <tbody>
                {r.porMes.map((m) => (
                  <tr key={m.mes} className={tabla.tr}>
                    <td className={cn(tabla.td, "font-medium capitalize")}>{etiquetaMes(m.mes)}</td>
                    <td className={cn(tabla.td, "text-right font-mono")}>{m.inscritos}</td>
                    <td className={cn(tabla.td, "text-right font-mono")}>{m.confirmados}</td>
                    <td className={cn(tabla.td, "text-right tabular-nums")}>{formatearSoles(m.ingresos)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </PanelTabla>
        </>
      ) : (
        <EstadoVacio icono={ChartColumnIcon} titulo="Sin inscripciones en el periodo" descripcion="Amplía el rango de fechas o elige otro curso." />
      )}
    </div>
  );
}
