import type { Metadata } from "next";
import { TicketPercentIcon } from "lucide-react";
import { BotonAccion } from "@/components/boton-accion";
import { BarraProgreso, EncabezadoPagina, EstadoVacio, PanelTabla, Pildora, tabla } from "@/components/comunes";
import { alternarCupon } from "@/features/administracion/acciones";
import { DialogoCupon } from "@/features/administracion/dialogos";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatearFecha, hoyISO } from "@/lib/formato";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Cupones" };

// HU-32 · Cupones de descuento
export default async function AdminCuponesPage() {
  await requireRol("administrador");
  const supabase = await createClient();
  const { data } = await supabase
    .from("cupones")
    .select("id, codigo, porcentaje_descuento, fecha_vigencia, usos_maximos, activo, pagos(count)")
    .order("fecha_vigencia", { ascending: false });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cupones = (data ?? []) as any[];
  const hoy = hoyISO();

  return (
    <div className="space-y-6">
      <EncabezadoPagina eyebrow="Comercial" titulo="Cupones de descuento" descripcion="Códigos promocionales aplicables en la inscripción en línea.">
        <DialogoCupon />
      </EncabezadoPagina>
      {cupones.length ? (
        <PanelTabla>
          <table className={tabla.table}>
            <thead className={tabla.thead}>
              <tr>
                <th className={tabla.th}>Código</th>
                <th className={tabla.th}>Descuento</th>
                <th className={tabla.th}>Vigente hasta</th>
                <th className={tabla.th}>Usos</th>
                <th className={tabla.th}>Estado</th>
                <th className={tabla.th} />
              </tr>
            </thead>
            <tbody>
              {cupones.map((c) => {
                const usos = c.pagos?.[0]?.count ?? 0;
                const vencido = c.fecha_vigencia < hoy;
                const agotado = c.usos_maximos && usos >= c.usos_maximos;
                return (
                  <tr key={c.id} className={tabla.tr}>
                    <td className={cn(tabla.td, "font-mono font-semibold", (vencido || !c.activo) && "text-muted-foreground line-through")}>{c.codigo}</td>
                    <td className={tabla.td}>
                      <Pildora color="coral">−{Number(c.porcentaje_descuento)} %</Pildora>
                    </td>
                    <td className={cn(tabla.td, "text-muted-foreground")}>{formatearFecha(c.fecha_vigencia)}</td>
                    <td className={tabla.td}>
                      {c.usos_maximos ? (
                        <div className="flex items-center gap-2">
                          <BarraProgreso valor={(usos / c.usos_maximos) * 100} className="h-1.5 w-20" tono="coral" />
                          <span className="font-mono text-xs">
                            {usos}/{c.usos_maximos}
                          </span>
                        </div>
                      ) : (
                        <span className="font-mono text-xs">{usos} · ilimitado</span>
                      )}
                    </td>
                    <td className={tabla.td}>
                      {vencido ? (
                        <Pildora>Vencido</Pildora>
                      ) : agotado ? (
                        <Pildora color="ambar">Agotado</Pildora>
                      ) : c.activo ? (
                        <Pildora color="verde">Activo</Pildora>
                      ) : (
                        <Pildora color="rojo">Pausado</Pildora>
                      )}
                    </td>
                    <td className={cn(tabla.td, "text-right")}>
                      {!vencido && (
                        <BotonAccion accion={alternarCupon} campos={{ id: c.id, activo: String(!c.activo) }} variant="outline" size="sm">
                          {c.activo ? "Pausar" : "Activar"}
                        </BotonAccion>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </PanelTabla>
      ) : (
        <EstadoVacio icono={TicketPercentIcon} titulo="Aún no hay cupones" descripcion="Crea un cupón para tus campañas de difusión." />
      )}
    </div>
  );
}
