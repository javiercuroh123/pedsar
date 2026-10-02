import type { Metadata } from "next";
import { CheckCircle2Icon, ReceiptIcon, WalletIcon } from "lucide-react";
import { EncabezadoPagina, EstadoBadge, EstadoVacio, PanelTabla, TarjetaKpi, tabla } from "@/components/comunes";
import { PLAZO_PAGO_HORAS, reservaVencida } from "@/config/matricula";
import { listarMisInscripciones } from "@/features/academico/consultas";
import { DialogoReembolso } from "@/features/academico/dialogo-reembolso";
import { PagoEnLinea } from "@/features/matricula/pago-en-linea-cliente";
import { PagoManual } from "@/features/matricula/pago-manual";
import { requireRol } from "@/lib/auth";
import { pagoManualHabilitado } from "@/lib/pagos";
import { createClient } from "@/lib/supabase/server";
import { etiquetaPago, formatearFecha, formatearSoles } from "@/lib/formato";

export const metadata: Metadata = { title: "Pagos y comprobantes" };

// HU-12 · Pagos · HU-30 · Comprobantes · HU-31 · Reembolsos · HU-50
export default async function EstudiantePagosPage({ searchParams }: PageProps<"/estudiante/pagos">) {
  const usuario = await requireRol("estudiante");
  const { inscripcion, pagar } = await searchParams;
  const nueva = typeof pagar === "string" ? pagar : inscripcion;
  const inscripciones = (await listarMisInscripciones(usuario.id)).filter((i) => i.pago);

  const supabase = await createClient();
  const { data: reembolsos } = inscripciones.length
    ? await supabase
        .from("reembolsos")
        .select("id, pago_id, motivo, monto, estado, fecha_solicitud")
        .in(
          "pago_id",
          inscripciones.map((i) => i.pago!.id),
        )
        .order("fecha_solicitud", { ascending: false })
    : { data: [] };

  const pagado = inscripciones.filter((i) => i.pago?.estado === "APROBADO").reduce((a, i) => a + i.pago!.monto, 0);
  const pendiente = inscripciones.filter((i) => i.pago?.estado === "PENDIENTE" && !reservaVencida(i)).reduce((a, i) => a + i.pago!.monto, 0);
  const reembolsables = inscripciones
    .filter((i) => i.pago?.estado === "APROBADO" && !(reembolsos ?? []).some((r) => r.pago_id === i.pago!.id && r.estado !== "RECHAZADO"))
    .map((i) => ({ id: i.pago!.id, etiqueta: `${i.curso.titulo} · ${formatearSoles(i.pago!.monto)}` }));
  const recien = typeof nueva === "string" ? inscripciones.find((i) => i.codigo === nueva) : undefined;
  // Pagos directos por Yape / Plin que el estudiante debe registrar (o que están en validación); el recién creado va primero.
  const porCompletar = inscripciones
    .filter((i) => i.estado === "PENDIENTE" && i.pago?.estado === "PENDIENTE" && (i.pago.metodo === "YAPE" || i.pago.metodo === "PLIN"))
    .sort((a, b) => Number(b.codigo === nueva) - Number(a.codigo === nueva));
  // Pagos en línea (Culqi) pendientes con la reserva vigente; el recién creado va primero.
  const porPagarEnLinea = inscripciones
    .filter((i) => i.estado === "PENDIENTE" && i.pago?.estado === "PENDIENTE" && i.pago.metodo === "CULQI" && !reservaVencida(i))
    .sort((a, b) => Number(b.codigo === nueva) - Number(a.codigo === nueva));

  return (
    <div className="space-y-6">
      <EncabezadoPagina titulo="Pagos y comprobantes" descripcion="Historial de pagos y comprobantes de pago en PDF." eyebrow="Cuenta" />

      {recien && (
        <div className="flex items-start gap-3 animar-escala rounded-2xl border border-green-100 bg-green-50 p-5 dark:border-green-500/25 dark:bg-green-500/10" role="status">
          <CheckCircle2Icon className="mt-0.5 size-6 shrink-0 text-green-600 dark:text-green-400" />
          <div>
            <p className="font-semibold text-green-900 dark:text-green-200">¡Inscripción registrada! · {recien.curso.titulo}</p>
            <p className="mt-1 text-sm text-green-800/80 dark:text-green-200/70">
              N.º <span className="font-mono">{recien.codigo}</span>. Tu cupo queda reservado por {PLAZO_PAGO_HORAS} horas:{" "}
              {recien.pago?.metodo === "CULQI"
                ? "paga en línea para confirmar tu matrícula al instante."
                : "realiza el pago y registra el N.º de operación para confirmar tu matrícula."}
            </p>
          </div>
        </div>
      )}

      {porPagarEnLinea.map((i) => (
        <PagoEnLinea
          key={i.id}
          pagoId={i.pago!.id}
          curso={i.curso.titulo}
          codigo={i.codigo}
          monto={i.pago!.monto}
          venceEn={i.vence_en}
          abrirAlCargar={typeof pagar === "string" && i.codigo === pagar}
          observacion={i.pago!.observacion}
          pagoManual={pagoManualHabilitado()}
        />
      ))}

      {porCompletar.map((i) => (
        <PagoManual
          key={i.id}
          estudianteId={usuario.id}
          curso={{ titulo: i.curso.titulo, slug: i.curso.slug }}
          codigo={i.codigo}
          pago={{
            id: i.pago!.id,
            metodo: i.pago!.metodo as "YAPE" | "PLIN",
            monto: i.pago!.monto,
            numero_operacion: i.pago!.numero_operacion,
            reportado_en: i.pago!.reportado_en,
            observacion: i.pago!.observacion,
            vence_en: i.vence_en,
          }}
        />
      ))}

      <div className="escalonado grid gap-4 sm:grid-cols-3">
        <TarjetaKpi etiqueta="Total pagado" valor={formatearSoles(pagado)} icono={WalletIcon} tono="turquesa" />
        <TarjetaKpi etiqueta="Pendiente de validación" valor={formatearSoles(pendiente)} icono={ReceiptIcon} tono="ambar" />
        <TarjetaKpi etiqueta="Comprobantes emitidos" valor={inscripciones.filter((i) => i.pago?.comprobante).length} icono={ReceiptIcon} tono="indigo" />
      </div>

      {inscripciones.length ? (
        <PanelTabla titulo="Historial de pagos">
          <table className={tabla.table}>
            <thead className={tabla.thead}>
              <tr>
                <th className={tabla.th}>Fecha</th>
                <th className={tabla.th}>Curso</th>
                <th className={tabla.th}>Método</th>
                <th className={`${tabla.th} text-right`}>Monto</th>
                <th className={tabla.th}>Estado</th>
                <th className={tabla.th}>Comprobante</th>
              </tr>
            </thead>
            <tbody>
              {inscripciones.map((i) => {
                const p = i.pago!;
                return (
                  <tr key={i.id} className={tabla.tr}>
                    <td className={`${tabla.td} whitespace-nowrap text-muted-foreground`}>{formatearFecha(p.fecha_pago ?? i.fecha_inscripcion)}</td>
                    <td className={`${tabla.td} font-medium`}>
                      {i.curso.titulo}
                      <span className="block font-mono text-xs font-normal text-muted-foreground">{i.codigo}</span>
                    </td>
                    <td className={tabla.td}>
                      {etiquetaPago(p.metodo, p.medio)}
                      {p.numero_operacion && <span className="block font-mono text-xs text-muted-foreground">Op. {p.numero_operacion}</span>}
                    </td>
                    <td className={`${tabla.td} text-right tabular-nums`}>{formatearSoles(p.monto)}</td>
                    <td className={tabla.td}>
                      <EstadoBadge estado={p.estado} />
                    </td>
                    <td className={tabla.td}>
                      {p.comprobante ? (
                        <a href={`/comprobantes/${p.comprobante.id}/pdf`} className="font-mono text-xs text-primary hover:underline">
                          {p.comprobante.serie}-{p.comprobante.numero}
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">{p.estado === "APROBADO" ? "En emisión" : "—"}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </PanelTabla>
      ) : (
        <EstadoVacio icono={ReceiptIcon} titulo="Aún no tienes pagos" descripcion="Cuando te inscribas en un curso, tu pago aparecerá aquí." />
      )}

      {(reembolsos ?? []).length > 0 && (
        <PanelTabla titulo="Solicitudes de reembolso">
          <table className={tabla.table}>
            <thead className={tabla.thead}>
              <tr>
                <th className={tabla.th}>Fecha</th>
                <th className={tabla.th}>Curso</th>
                <th className={tabla.th}>Motivo</th>
                <th className={`${tabla.th} text-right`}>Monto</th>
                <th className={tabla.th}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {(reembolsos ?? []).map((r) => (
                <tr key={r.id} className={tabla.tr}>
                  <td className={`${tabla.td} text-muted-foreground`}>{formatearFecha(r.fecha_solicitud)}</td>
                  <td className={`${tabla.td} font-medium`}>{inscripciones.find((i) => i.pago?.id === r.pago_id)?.curso.titulo}</td>
                  <td className={`${tabla.td} max-w-xs text-muted-foreground`}>{r.motivo}</td>
                  <td className={`${tabla.td} text-right tabular-nums`}>{formatearSoles(Number(r.monto))}</td>
                  <td className={tabla.td}>
                    <EstadoBadge estado={r.estado} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </PanelTabla>
      )}

      <p className="text-sm text-muted-foreground">
        ¿Necesitas una devolución? {reembolsables.length ? <DialogoReembolso pagos={reembolsables} /> : <span>No tienes pagos aprobados reembolsables.</span>}
      </p>
    </div>
  );
}
