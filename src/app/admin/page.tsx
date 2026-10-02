import type { Metadata } from "next";
import Link from "next/link";
import { AwardIcon, ClipboardListIcon, UsersIcon, WalletIcon } from "lucide-react";
import { BarraProgreso, EncabezadoPagina, PanelTabla, TarjetaKpi, tabla } from "@/components/comunes";
import { BotonAccion } from "@/components/boton-accion";
import { resolverPago } from "@/features/administracion/acciones";
import { GraficoBarras } from "@/features/administracion/grafico-barras";
import { GraficoDona } from "@/features/administracion/grafico-dona";
import { uno } from "@/features/academico/consultas";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ETIQUETA_MODALIDAD, etiquetaPago, formatearSoles, hoyISO, nombreCompleto } from "@/lib/formato";
import { cn } from "@/lib/utils";
import type { MedioPago, MetodoPago, Modalidad } from "@/types/dominio";

export const metadata: Metadata = { title: "Panel principal" };

const COLOR_MODALIDAD: Record<Modalidad, string> = { VIRTUAL: "var(--chart-1)", PRESENCIAL: "var(--chart-5)", SEMIPRESENCIAL: "var(--chart-3)" };
const MES = new Intl.DateTimeFormat("es-PE", { month: "short", timeZone: "America/Lima" });

// HU-20 · Panel de administración con indicadores
export default async function AdminPage() {
  await requireRol("administrador");
  const supabase = await createClient();
  const hoy = hoyISO();
  const inicioMes = `${hoy.slice(0, 7)}-01`;
  const hace12 = new Date(`${hoy.slice(0, 7)}-15T12:00:00Z`);
  hace12.setUTCMonth(hace12.getUTCMonth() - 11);
  const desde = `${hace12.toISOString().slice(0, 7)}-01`;

  const [usuarios, usuariosMes, inscripciones, pagos, certificados, cursos, pendientes] = await Promise.all([
    supabase.from("perfiles").select("id", { head: true, count: "exact" }),
    supabase.from("perfiles").select("id", { head: true, count: "exact" }).gte("fecha_registro", inicioMes),
    supabase.from("inscripciones").select("id, curso_id, estado, fecha_inscripcion").gte("fecha_inscripcion", desde),
    supabase.from("pagos").select("monto, fecha_pago").eq("estado", "APROBADO"),
    supabase.from("certificados").select("id", { head: true, count: "exact" }),
    supabase.from("cursos").select("id, titulo, modalidad, cupo_maximo, estado"),
    supabase
      .from("inscripciones")
      .select("id, codigo, estudiante:perfiles(nombres, apellidos, correo), curso:cursos(titulo), pagos(monto, metodo, medio)")
      .eq("estado", "PENDIENTE")
      .order("fecha_inscripcion", { ascending: false })
      .limit(6),
  ]);

  const filasIns = (inscripciones.data ?? []) as { id: string; curso_id: string; estado: string; fecha_inscripcion: string }[];
  const filasPagos = (pagos.data ?? []) as { monto: number; fecha_pago: string | null }[];
  const listaCursos = (cursos.data ?? []) as { id: string; titulo: string; modalidad: Modalidad; cupo_maximo: number; estado: string }[];

  const ingresos = filasPagos.reduce((a, p) => a + Number(p.monto), 0);
  const ingresosMes = filasPagos.filter((p) => (p.fecha_pago ?? "") >= inicioMes).reduce((a, p) => a + Number(p.monto), 0);
  const insMes = filasIns.filter((i) => i.fecha_inscripcion >= inicioMes).length;

  // Serie mensual de matrículas (últimos 12 meses).
  const meses = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(hace12);
    d.setUTCMonth(d.getUTCMonth() + i);
    const clave = d.toISOString().slice(0, 7);
    return { clave, etiqueta: MES.format(d).replace(".", ""), valor: filasIns.filter((x) => x.fecha_inscripcion.slice(0, 7) === clave).length };
  });

  const publicados = listaCursos.filter((c) => c.estado === "PUBLICADO");
  const porModalidad = (Object.keys(ETIQUETA_MODALIDAD) as Modalidad[]).map((m) => ({ m, n: publicados.filter((c) => c.modalidad === m).length }));
  const ocupacion = publicados
    .map((c) => ({ ...c, ins: filasIns.filter((i) => i.curso_id === c.id && i.estado !== "CANCELADA").length }))
    .map((c) => ({ ...c, p: Math.round((c.ins / c.cupo_maximo) * 100) }))
    .sort((a, b) => b.p - a.p)
    .slice(0, 5);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const listaPendientes = (pendientes.data ?? []) as any[];

  return (
    <div className="space-y-8">
      <EncabezadoPagina eyebrow="Administración" titulo="Panel de administración" descripcion="Indicadores de usuarios, inscripciones e ingresos en tiempo real.">
        <Link href="/admin/reportes" className="text-sm font-medium text-primary hover:underline">
          Ver reportes →
        </Link>
      </EncabezadoPagina>

      <div className="escalonado grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <TarjetaKpi etiqueta="Usuarios registrados" valor={(usuarios.count ?? 0).toLocaleString("es-PE")} icono={UsersIcon} tono="indigo" detalle={`+${usuariosMes.count ?? 0} este mes`} />
        <TarjetaKpi etiqueta="Inscripciones (12 meses)" valor={filasIns.length.toLocaleString("es-PE")} icono={ClipboardListIcon} tono="coral" detalle={`${insMes} este mes`} />
        <TarjetaKpi etiqueta="Ingresos registrados" valor={formatearSoles(ingresos)} icono={WalletIcon} tono="turquesa" detalle={`${formatearSoles(ingresosMes)} este mes`} />
        <TarjetaKpi etiqueta="Certificados emitidos" valor={certificados.count ?? 0} icono={AwardIcon} tono="ambar" detalle={<Link href="/admin/certificados" className="hover:text-primary">Emitir pendientes →</Link>} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="animar-entrada rounded-2xl border bg-card p-6 shadow-xs [--i:2] lg:col-span-2">
          <h2 className="text-lg font-semibold tracking-tight">Matrículas por mes</h2>
          <p className="text-sm text-muted-foreground">Inscripciones registradas en los últimos 12 meses</p>
          <GraficoBarras datos={meses} etiqueta="Matrículas por mes" />
        </section>
        <section className="animar-entrada rounded-2xl border bg-card p-6 shadow-xs [--i:3]">
          <h2 className="text-lg font-semibold tracking-tight">Oferta por modalidad</h2>
          <p className="mb-6 text-sm text-muted-foreground">{publicados.length} cursos publicados</p>
          <GraficoDona
            etiqueta="Oferta por modalidad"
            total={publicados.length}
            datos={porModalidad.map(({ m, n }) => ({ clave: m, etiqueta: ETIQUETA_MODALIDAD[m], valor: n, color: COLOR_MODALIDAD[m] }))}
          />
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <PanelTabla
          className="lg:col-span-2"
          titulo="Pagos por verificar"
          descripcion="Inscripciones pendientes de validación"
          accion={
            <Link href="/admin/inscripciones" className="text-sm font-medium text-primary hover:underline">
              Ver todos
            </Link>
          }
        >
          {listaPendientes.length ? (
            <table className={cn(tabla.table, "min-w-155")}>
              <tbody>
                {listaPendientes.map((x) => {
                  const e = uno<{ nombres: string; apellidos: string; correo: string }>(x.estudiante);
                  const pago = uno<{ monto: number; metodo: MetodoPago; medio: MedioPago | null }>(x.pagos);
                  return (
                    <tr key={x.id} className={tabla.tr}>
                      <td className={tabla.td}>
                        <p className="font-medium">{nombreCompleto(e) || e?.correo}</p>
                        <p className="text-xs text-muted-foreground">{uno<{ titulo: string }>(x.curso)?.titulo}</p>
                      </td>
                      <td className={cn(tabla.td, "text-muted-foreground")}>{pago ? etiquetaPago(pago.metodo, pago.medio) : "—"}</td>
                      <td className={cn(tabla.td, "text-right tabular-nums")}>{pago ? formatearSoles(Number(pago.monto)) : "—"}</td>
                      <td className={cn(tabla.td, "text-right whitespace-nowrap")}>
                        <BotonAccion accion={resolverPago} campos={{ inscripcionId: x.id, decision: "rechazar" }} confirmar="¿Rechazar este pago y cancelar la inscripción?" variant="ghost" size="sm">
                          Rechazar
                        </BotonAccion>{" "}
                        {pago?.metodo !== "CULQI" && (
                          <BotonAccion accion={resolverPago} campos={{ inscripcionId: x.id, decision: "aprobar" }} size="sm">
                            Confirmar
                          </BotonAccion>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">No hay pagos por verificar. ✨</p>
          )}
        </PanelTabla>
        <section className="rounded-2xl border bg-card p-5 shadow-xs">
          <h2 className="text-lg font-semibold tracking-tight">Ocupación por curso</h2>
          {ocupacion.length ? (
            <ul className="mt-5 space-y-4">
              {ocupacion.map((c) => (
                <li key={c.id}>
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="truncate">{c.titulo}</span>
                    <span className="font-mono text-xs text-muted-foreground">{c.p}%</span>
                  </div>
                  <BarraProgreso valor={c.p} tono={c.p >= 100 ? "rojo" : c.p >= 80 ? "ambar" : "indigo"} className="mt-1.5 h-1.5" etiqueta={c.titulo} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-5 text-sm text-muted-foreground">Sin cursos publicados.</p>
          )}
        </section>
      </div>
    </div>
  );
}
