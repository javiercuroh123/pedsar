import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardListIcon, ClockIcon, ReceiptIcon, WalletIcon } from "lucide-react";
import { BotonAccion } from "@/components/boton-accion";
import { EncabezadoPagina, EstadoBadge, EstadoVacio, PanelTabla, PestanasEnlace, Pildora, TarjetaKpi, tabla } from "@/components/comunes";
import { uno } from "@/features/academico/consultas";
import { resolverPago, resolverReembolso } from "@/features/administracion/acciones";
import { DialogoObservarPago } from "@/features/administracion/dialogos";
import { requireRol } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { reservaVencida } from "@/config/matricula";
import { etiquetaPago, formatearFecha, formatearFechaHora, formatearSoles, hoyISO, nombreCompleto } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { Constants } from "@/types/database";
import type { MedioPago, MetodoPago } from "@/types/dominio";

export const metadata: Metadata = { title: "Inscripciones y pagos" };

type Persona = { nombres: string; apellidos: string; correo: string };
type PagoFila = {
  monto: number;
  metodo: MetodoPago;
  medio: MedioPago | null;
  referencia_pasarela: string | null;
  estado: string;
  numero_operacion: string | null;
  voucher_ruta: string | null;
  reportado_en: string | null;
  observacion: string | null;
  comprobantes: unknown;
};

// HU-07 · HU-17 · HU-12 · HU-31 · Inscripciones, pagos y reembolsos
export default async function AdminInscripcionesPage({ searchParams }: PageProps<"/admin/inscripciones">) {
  await requireRol("administrador");
  const { tab, estado } = await searchParams;
  const pestana = tab === "reembolsos" ? "reembolsos" : "inscripciones";
  const filtro = Constants.public.Enums.estado_inscripcion.find((e) => e === estado) ?? "";
  const supabase = await createClient();
  const inicioMes = `${hoyISO().slice(0, 7)}-01`;

  let consulta = supabase
    .from("inscripciones")
    .select(
      "id, codigo, estado, fecha_inscripcion, vence_en, estudiante:perfiles(nombres, apellidos, correo), curso:cursos(titulo), pagos(monto, metodo, medio, referencia_pasarela, estado, fecha_pago, numero_operacion, voucher_ruta, reportado_en, observacion, comprobantes(id, serie, numero))",
    )
    .order("fecha_inscripcion", { ascending: false })
    .limit(200);
  if (filtro) consulta = consulta.eq("estado", filtro);

  const [{ data }, { count: pendientes }, { count: reportados }, { data: pagosMes }, { data: reembolsos }] = await Promise.all([
    consulta,
    supabase.from("inscripciones").select("id", { head: true, count: "exact" }).eq("estado", "PENDIENTE"),
    supabase.from("pagos").select("id", { head: true, count: "exact" }).eq("estado", "PENDIENTE").not("reportado_en", "is", null),
    supabase.from("pagos").select("monto").eq("estado", "APROBADO").gte("fecha_pago", inicioMes),
    supabase
      .from("reembolsos")
      .select("id, motivo, monto, estado, fecha_solicitud, pago:pagos(inscripcion:inscripciones(estudiante:perfiles(nombres, apellidos, correo), curso:cursos(titulo)))")
      .order("fecha_solicitud", { ascending: false }),
  ]);
  // Los pagos ya reportados por el estudiante (por validar) van primero.
  const porValidar = (x: { estado: string; pagos: unknown }) => x.estado === "PENDIENTE" && Boolean(uno<PagoFila>(x.pagos)?.reportado_en);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filas = ((data ?? []) as any[]).sort((a, b) => Number(porValidar(b)) - Number(porValidar(a)));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const listaReembolsos = (reembolsos ?? []) as any[];

  // Capturas de Yape / Plin: bucket privado, se muestran con URLs firmadas de corta duración.
  const rutas = filas.map((x) => uno<PagoFila>(x.pagos)?.voucher_ruta).filter((r): r is string => Boolean(r));
  const { data: firmadas } = rutas.length ? await createAdminClient().storage.from("vouchers").createSignedUrls(rutas, 60 * 10) : { data: [] };
  const urlCaptura = new Map((firmadas ?? []).filter((f) => f.path && f.signedUrl).map((f) => [f.path as string, f.signedUrl]));
  const solicitados = listaReembolsos.filter((r) => r.estado === "SOLICITADO").length;
  const ingresosMes = (pagosMes ?? []).reduce((a: number, p: { monto: number }) => a + Number(p.monto), 0);

  return (
    <div className="space-y-6">
      <EncabezadoPagina eyebrow="Comercial" titulo="Inscripciones y pagos" descripcion="Confirma matrículas, verifica pagos y gestiona reembolsos." />

      <div className="escalonado grid gap-4 sm:grid-cols-3">
        <TarjetaKpi
          etiqueta="Pendientes de verificación"
          valor={pendientes ?? 0}
          icono={ClockIcon}
          tono="ambar"
          detalle={reportados ? `${reportados} con pago reportado por validar` : "Ningún pago reportado por validar"}
        />
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
                    const pago = uno<PagoFila>(x.pagos);
                    const captura = pago?.voucher_ruta ? urlCaptura.get(pago.voucher_ruta) : undefined;
                    const reportado = x.estado === "PENDIENTE" && Boolean(pago?.reportado_en);
                    const comp = uno<{ id: number; serie: string; numero: string }>(pago?.comprobantes);
                    const enLinea = pago?.metodo === "CULQI";
                    return (
                      <tr key={x.id} className={tabla.tr}>
                        <td className={cn(tabla.td, "font-mono text-xs")}>{x.codigo}</td>
                        <td className={tabla.td}>
                          <p className="font-medium">{nombreCompleto(e) || e?.correo}</p>
                          <p className="text-xs text-muted-foreground">{e?.correo}</p>
                        </td>
                        <td className={cn(tabla.td, "text-muted-foreground")}>{uno<{ titulo: string }>(x.curso)?.titulo}</td>
                        <td className={cn(tabla.td, "whitespace-nowrap text-muted-foreground")}>{formatearFecha(x.fecha_inscripcion)}</td>
                        <td className={cn(tabla.td, "whitespace-nowrap")}>
                          {pago ? etiquetaPago(pago.metodo, pago.medio) : "—"}
                          {pago?.referencia_pasarela && (
                            <span className="block font-mono text-xs text-muted-foreground" title="Referencia de Culqi">
                              {pago.referencia_pasarela}
                            </span>
                          )}
                        </td>
                        <td className={cn(tabla.td, "text-right tabular-nums")}>{pago ? formatearSoles(Number(pago.monto)) : "—"}</td>
                        <td className={tabla.td}>
                          {pago ? <EstadoBadge estado={pago.estado} /> : "—"}
                          {pago?.numero_operacion && (
                            <span className="mt-1 block font-mono text-xs" title="N.º de operación informado por el estudiante">
                              Op. {pago.numero_operacion}
                            </span>
                          )}
                          {captura && (
                            <a href={captura} target="_blank" rel="noreferrer" className="block text-xs font-medium text-primary hover:underline">
                              Ver captura
                            </a>
                          )}
                          {reportado ? (
                            <span className="block text-xs text-muted-foreground">Reportado {formatearFecha(pago!.reportado_en!)}</span>
                          ) : x.estado === "PENDIENTE" && pago?.estado === "PENDIENTE" ? (
                            <span className="block text-xs text-muted-foreground">
                              {reservaVencida(x)
                                ? "Reserva vencida · se cancelará en breve"
                                : `${enLinea ? (pago.observacion ? `Rechazado: ${pago.observacion}` : "Esperando el pago en línea") : pago.observacion ? "Observado · esperando corrección" : "Sin reportar"}${x.vence_en ? ` · vence ${formatearFechaHora(x.vence_en)}` : ""}`}
                            </span>
                          ) : null}
                        </td>
                        <td className={tabla.td}>
                          <EstadoBadge estado={x.estado} />
                        </td>
                        <td className={cn(tabla.td, "text-right whitespace-nowrap")}>
                          {x.estado === "PENDIENTE" ? (
                            <>
                              <BotonAccion
                                accion={resolverPago}
                                campos={{ inscripcionId: x.id, decision: "rechazar" }}
                                confirmar={`¿Rechazar el pago de ${x.codigo}? La inscripción se cancelará.`}
                                variant="ghost"
                                size="sm"
                              >
                                Rechazar
                              </BotonAccion>{" "}
                              {reportado && (
                                <>
                                  <DialogoObservarPago inscripcionId={x.id} codigo={x.codigo} />{" "}
                                </>
                              )}
                              {/* El pago en línea lo confirma Culqi; el administrador solo valida el pago directo. */}
                              {!enLinea && (
                                <BotonAccion accion={resolverPago} campos={{ inscripcionId: x.id, decision: "aprobar" }} size="sm">
                                  Confirmar
                                </BotonAccion>
                              )}
                            </>
                          ) : comp ? (
                            <a href={`/comprobantes/${comp.id}/pdf`} className="font-mono text-xs text-primary hover:underline">
                              {comp.serie}-{comp.numero}
                            </a>
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
