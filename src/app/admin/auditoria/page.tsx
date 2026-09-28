import type { Metadata } from "next";
import Form from "next/form";
import { ScrollTextIcon, SearchIcon } from "lucide-react";
import { EncabezadoPagina, EstadoVacio, PanelTabla, Pildora, tabla, type ColorPildora } from "@/components/comunes";
import { Input } from "@/components/ui/input";
import { uno } from "@/features/academico/consultas";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatearFechaHora, nombreCompleto } from "@/lib/formato";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Auditoría" };

const colorAccion = (a: string): ColorPildora =>
  /FALLIDO|RECHAZAR|ELIMINAR|DESACTIVAR/.test(a) ? "rojo" : /CONFIRMAR|EMITIR|PUBLICAR|APROBAR|ACTIVAR/.test(a) ? "verde" : /PAGO|INSCRIPCION|REEMBOLSO/.test(a) ? "ambar" : "gris";

// HU-61 · Registro de actividad · HU-44
export default async function AdminAuditoriaPage({ searchParams }: PageProps<"/admin/auditoria">) {
  await requireRol("administrador");
  const { q } = await searchParams;
  const texto = typeof q === "string" ? q.trim().toLowerCase() : "";
  const supabase = await createClient();

  const { data } = await supabase
    .from("registro_actividad")
    .select("id, accion, detalle, direccion_ip, fecha_hora, usuario:perfiles(nombres, apellidos, correo, rol)")
    .order("fecha_hora", { ascending: false })
    .limit(300);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const eventos = ((data ?? []) as any[]).filter(
    (e) => !texto || `${e.accion} ${JSON.stringify(e.detalle ?? "")} ${JSON.stringify(e.usuario ?? "")}`.toLowerCase().includes(texto),
  );

  return (
    <div className="space-y-6">
      <EncabezadoPagina eyebrow="Sistema" titulo="Registro de actividad" descripcion="Auditoría de acciones críticas del sistema (últimos 300 eventos)." />
      <Form action="/admin/auditoria" className="relative max-w-md">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input name="q" type="search" defaultValue={texto} placeholder="Buscar por usuario, acción o detalle" className="h-9 bg-card pl-9" aria-label="Buscar en la auditoría" />
      </Form>
      {eventos.length ? (
        <PanelTabla>
          <table className={cn(tabla.table, "min-w-245")}>
            <thead className={tabla.thead}>
              <tr>
                <th className={tabla.th}>Fecha y hora</th>
                <th className={tabla.th}>Usuario</th>
                <th className={tabla.th}>Acción</th>
                <th className={tabla.th}>Detalle</th>
                <th className={tabla.th}>Dirección IP</th>
              </tr>
            </thead>
            <tbody>
              {eventos.map((e) => {
                const u = uno<{ nombres: string; apellidos: string; correo: string; rol: string }>(e.usuario);
                return (
                  <tr key={e.id} className={tabla.tr}>
                    <td className={cn(tabla.td, "font-mono text-xs whitespace-nowrap")}>{formatearFechaHora(e.fecha_hora)}</td>
                    <td className={tabla.td}>
                      <p className="text-sm">{u ? nombreCompleto(u) || u.correo : "Sistema"}</p>
                      <p className="text-xs text-muted-foreground capitalize">{u?.rol ?? "—"}</p>
                    </td>
                    <td className={tabla.td}>
                      <Pildora color={colorAccion(e.accion)} className="font-mono">
                        {e.accion}
                      </Pildora>
                    </td>
                    <td className={cn(tabla.td, "max-w-md truncate font-mono text-xs text-muted-foreground")} title={e.detalle ? JSON.stringify(e.detalle) : undefined}>
                      {e.detalle
                        ? Object.entries(e.detalle as Record<string, unknown>)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(" · ")
                        : "—"}
                    </td>
                    <td className={cn(tabla.td, "font-mono text-xs")}>{e.direccion_ip ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </PanelTabla>
      ) : (
        <EstadoVacio icono={ScrollTextIcon} titulo="Sin eventos registrados" />
      )}
    </div>
  );
}
