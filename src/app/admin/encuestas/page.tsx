import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardListIcon } from "lucide-react";
import { EncabezadoPagina, EstadoVacio, PanelTabla, Pildora, tabla } from "@/components/comunes";
import { listarEncuestasAdmin } from "@/features/encuestas/consultas";
import { DialogoNuevaEncuesta } from "@/features/encuestas/dialogos-admin";
import { requireRol } from "@/lib/auth";
import { formatearFecha } from "@/lib/formato";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Encuestas" };

// HU-43 · Encuestas de satisfacción: la activa se envía al emitirse cada certificado
export default async function AdminEncuestasPage() {
  await requireRol("administrador");
  const encuestas = await listarEncuestasAdmin();
  const activa = encuestas.find((e) => e.activa);

  return (
    <div className="space-y-6">
      <EncabezadoPagina
        eyebrow="Académico"
        titulo="Encuestas de satisfacción"
        descripcion={
          activa
            ? `«${activa.titulo}» se envía a cada estudiante cuando recibe su certificado.`
            : "No hay encuesta activa: activa una para que se envíe al terminar cada curso."
        }
      >
        <DialogoNuevaEncuesta />
      </EncabezadoPagina>

      {encuestas.length ? (
        <PanelTabla>
          <table className={cn(tabla.table, "min-w-200")}>
            <thead className={tabla.thead}>
              <tr>
                <th className={tabla.th}>Encuesta</th>
                <th className={cn(tabla.th, "text-right")}>Preguntas</th>
                <th className={cn(tabla.th, "text-right")}>Enviadas</th>
                <th className={cn(tabla.th, "text-right")}>Respondidas</th>
                <th className={cn(tabla.th, "text-right")}>Tasa de respuesta</th>
                <th className={tabla.th}>Creada</th>
              </tr>
            </thead>
            <tbody>
              {encuestas.map((e) => (
                <tr key={e.id} className={tabla.tr}>
                  <td className={tabla.td}>
                    <Link href={`/admin/encuestas/${e.id}`} className="font-medium hover:text-primary hover:underline">
                      {e.titulo}
                    </Link>
                    <div className="mt-1">
                      {e.activa ? (
                        <Pildora color="verde">Activa</Pildora>
                      ) : e.enviadas ? (
                        <Pildora color="gris">Cerrada</Pildora>
                      ) : (
                        <Pildora color="ambar">Borrador</Pildora>
                      )}
                    </div>
                  </td>
                  <td className={cn(tabla.td, "text-right tabular-nums")}>{e.preguntas}</td>
                  <td className={cn(tabla.td, "text-right tabular-nums")}>{e.enviadas}</td>
                  <td className={cn(tabla.td, "text-right tabular-nums")}>{e.respondidas}</td>
                  <td className={cn(tabla.td, "text-right tabular-nums")}>{e.enviadas ? `${Math.round((e.respondidas * 100) / e.enviadas)} %` : "—"}</td>
                  <td className={cn(tabla.td, "text-sm whitespace-nowrap text-muted-foreground")}>{formatearFecha(e.creadaEn)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </PanelTabla>
      ) : (
        <EstadoVacio icono={ClipboardListIcon} titulo="Aún no hay encuestas" descripcion="Crea una encuesta y actívala para medir la satisfacción de tus estudiantes." />
      )}
    </div>
  );
}
