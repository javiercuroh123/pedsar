import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardListIcon, ClockIcon, ReceiptIcon, WalletIcon } from "lucide-react";
import { BotonAccion } from "@/components/boton-accion";
import { EncabezadoPagina, EstadoBadge, EstadoVacio, PanelTabla, PestanasEnlace, Pildora, TarjetaKpi, tabla } from "@/components/comunes";
import { uno } from "@/features/academico/consultas";
import { resolverPago, resolverReembolso } from "@/features/administracion/acciones";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ETIQUETA_METODO, formatearFecha, formatearSoles, hoyISO, nombreCompleto } from "@/lib/formato";
import { cn } from "@/lib/utils";
import type { MetodoPago } from "@/types/dominio";

export const metadata: Metadata = { title: "Inscripciones y pagos" };

type Persona = { nombres: string; apellidos: string; correo: string };

// HU-07 · HU-17 · HU-12 · HU-31 · Inscripciones, pagos y reembolsos
export default async function AdminInscripcionesPage({ searchParams }: PageProps<"/admin/inscripciones">) {
  await requireRol("administrador");
  const { tab, estado } = await searchParams;
  const pestana = tab === "reembolsos" ? "reembolsos" : "inscripciones";
  const filtro = typeof estado === "string" ? estado : "";
  const supabase = await createClient();
  const inicioMes = `${hoyISO().slice(0, 7)}-01`;

  let consulta = supabase
    .from("inscripciones")
    .select("id, codigo, estado, fecha_inscripcion, estudiante:perfiles(nombres, apellidos, correo), curso:cursos(titulo), pagos(monto, metodo, estado, fecha_pago, comprobantes(serie, numero))")
    .order("fecha_inscripcion", { ascending: false })
    .limit(200);
  if (filtro) consulta = consulta.eq("estado", filtro);

  const [{ data }, { count: pendientes }, { data: pagosMes }, { data: reembolsos }] = await Promise.all([
    consulta,
    supabase.from("inscripciones").select("id", { head: true, count: "exact" }).eq("estado", "PENDIENTE"),
    supabase.from("pagos").select("monto").eq("estado", "APROBADO").gte("fecha_pago", inicioMes),
    supabase
      .from("reembolsos")
      .select("id, motivo, monto, estado, fecha_solicitud, pago:pagos(inscripcion:inscripciones(estudiante:perfiles(nombres, apellidos, correo), curso:cursos(titulo)))")
      .order("fecha_solicitud", { ascending: false }),
  ]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filas = (data ?? []) as any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const listaReembolsos = (reembolsos ?? []) as any[];
  const solicitados = listaReembolsos.filter((r) => r.estado === "SOLICITADO").length;
  const ingresosMes = (pagosMes ?? []).reduce((a: number, p: { monto: number }) => a + Number(p.monto), 0);

  return (
    <div className="space-y-6">
      <EncabezadoPagina eyebrow="Comercial" titulo="Inscripciones y pagos" descripcion="Confirma matrículas, verifica pagos y gestiona reembolsos." />

      <div className="escalonado grid gap-4 sm:grid-cols-3">
        <TarjetaKpi etiqueta="Pendientes de verificación" valor={pendientes ?? 0} icono={ClockIcon} tono="ambar" />
        <TarjetaKpi etiqueta="Ingresos del mes" valor={formatearSoles(ingresosMes)} icono={WalletIcon} tono="turquesa" />
        <TarjetaKpi etiqueta="Reembolsos por atender" valor={solicitados} icono={ReceiptIcon} tono="rosa" />
      </div>

      <PestanasEnlace
        activa={pestana}
        items={[
          { valor: "inscripciones", etiqueta: "Inscripciones", href: "/admin/inscripciones" },
          {
            valor: "reembolsos",
            etiqueta: (
              <>
                Reembolsos {solicitados > 0 && <Pildora color="ambar">{solicitados}</Pildora>}
              </>
            ),
            href: "/admin/inscripciones?tab=reembolsos",
          },
        ]}
      />

      {pestana === "inscripciones" ? (
        <>
          <div className="inline-flex rounded-lg bg-muted p-1 text-sm">
            {[
              ["", "Todas"],
              ["PENDIENTE", "Pendientes"],
              ["CONFIRMADA", "Confirmadas"],
              ["CANCELADA", "Canceladas"],
            ].map(([v, t]) => (
              <Link key={v} href={v ? `?estado=${v}` : "?"} className={cn("rounded-md px-3 py-1.5 font-medium", filtro === v ? "bg-background shadow-sm" : "text-muted-foreground")}>
                {t}
              </Link>
            ))}
          </div>
          {filas.length ? (
            <PanelTabla>
              <table className={cn(tabla.table, "min-w-250")}>
                <thead className={tabla.thead}>
                  <tr>
                    <th className={tabla.th}>N.º</th>
                    <th className={tabla.th}>Estudiante</th>
                    <th className={tabla.th}>Curso</th>
                    <th className={tabla.th}>Fecha</th>
                    <th className={tabla.th}>Método</th>
                    <th className={cn(tabla.th, "text-right")}>Monto</th>
                    <th className={tabla.th}>Pago</th>
                    <th className={tabla.th}>Inscripción</th>
                    <th className={cn(tabla.th, "text-right")}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((x) => {
                    const e = uno<Persona>(x.estudiante);
                    const pago = uno<{ monto: number; metodo: MetodoPago; estado: string; comprobantes: unknown }>(x.pagos);
                    const comp = uno<{ serie: string; numero: string }>(pago?.comprobantes);
                    return (
                      <tr key={x.id} className={tabla.tr}>
                        <td className={cn(tabla.td, "font-mono text-xs")}>{x.codigo}</td>
                        <td className={tabla.td}>
                          <p className="font-medium">{nombreCompleto(e) || e?.correo}</p>
                          <p className="text-xs text-muted-foreground">{e?.correo}</p>
                        </td>
                        <td className={cn(tabla.td, "text-muted-foreground")}>{uno<{ titulo: string }>(x.curso)?.titulo}</td>
                        <td className={cn(tabla.td, "whitespace-nowrap text-muted-foreground")}>{formatearFecha(x.fecha_inscripcion)}</td>
                        <td className={cn(tabla.td, "whitespace-nowrap")}>{pago ? ETIQUETA_METODO[pago.metodo] : "—"}</td>
                        <td className={cn(tabla.td, "text-right tabular-nums")}>{pago ? formatearSoles(Number(pago.monto)) : "—"}</td>
                        <td className={tabla.td}>{pago ? <EstadoBadge estado={pago.estado} /> : "—"}</td>
                        <td className={tabla.td}>
                          <EstadoBadge estado={x.estado} />
                        </td>
                        <td className={cn(tabla.td, "text-right whitespace-nowrap")}>
                          {x.estado === "PENDIENTE" ? (
                            <>
                              <BotonAccion accion={resolverPago} campos={{ inscripcionId: x.id, decision: "rechazar" }} confirmar={`¿Rechazar el pago de ${x.codigo}?`} variant="ghost" size="sm">
                                Rechazar
                              </BotonAccion>{" "}
                              <BotonAccion accion={resolverPago} campos={{ inscripcionId: x.id, decision: "aprobar" }} size="sm">
                                Confirmar
                              </BotonAccion>
                            </>
                          ) : comp ? (
                            <span className="font-mono text-xs">
                              {comp.serie}-{comp.numero}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </PanelTabla>
          ) : (
            <EstadoVacio icono={ClipboardListIcon} titulo="No hay inscripciones con este filtro" />
          )}
        </>
      ) : listaReembolsos.length ? (
        <PanelTabla>
          <table className={tabla.table}>
            <thead className={tabla.thead}>
              <tr>
                <th className={tabla.th}>Estudiante</th>
                <th className={tabla.th}>Curso</th>
                <th className={tabla.th}>Motivo</th>
                <th className={cn(tabla.th, "text-right")}>Monto</th>
                <th className={tabla.th}>Solicitud</th>
                <th className={tabla.th}>Estado</th>
                <th className={cn(tabla.th, "text-right")}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {listaReembolsos.map((r) => {
                const ins = uno<{ estudiante: unknown; curso: unknown }>(uno<{ inscripcion: unknown }>(r.pago)?.inscripcion);
                const e = uno<Persona>(ins?.estudiante);
                return (
                  <tr key={r.id} className={tabla.tr}>
                    <td className={cn(tabla.td, "font-medium")}>{nombreCompleto(e) || e?.correo}</td>
                    <td className={cn(tabla.td, "text-muted-foreground")}>{uno<{ titulo: string }>(ins?.curso)?.titulo}</td>
                    <td className={cn(tabla.td, "max-w-xs text-muted-foreground")}>{r.motivo}</td>
                    <td className={cn(tabla.td, "text-right tabular-nums")}>{formatearSoles(Number(r.monto))}</td>
                    <td className={cn(tabla.td, "text-muted-foreground")}>{formatearFecha(r.fecha_solicitud)}</td>
                    <td className={tabla.td}>
                      <EstadoBadge estado={r.estado} />
                    </td>
                    <td className={cn(tabla.td, "text-right whitespace-nowrap")}>
                      {r.estado === "SOLICITADO" ? (
                        <>
                          <BotonAccion accion={resolverReembolso} campos={{ id: r.id, decision: "rechazar" }} variant="outline" size="sm">
                            Rechazar
                          </BotonAccion>{" "}
                          <BotonAccion accion={resolverReembolso} campos={{ id: r.id, decision: "aprobar" }} confirmar="¿Aprobar el reembolso? La inscripción se cancelará." size="sm">
                            Aprobar
                          </BotonAccion>
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </PanelTabla>
      ) : (
        <EstadoVacio icono={ReceiptIcon} titulo="No hay solicitudes de reembolso" />
      )}
    </div>
  );
}
