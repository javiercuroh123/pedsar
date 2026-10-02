import type { Metadata } from "next";
import { StarIcon } from "lucide-react";
import { EncabezadoPagina, EstadoVacio, PanelTabla, Pildora, tabla } from "@/components/comunes";
import { BotonAccion } from "@/components/boton-accion";
import { listarResenasAdmin } from "@/features/comunidad/consultas-resenas";
import { Estrellas } from "@/features/comunidad/estrellas";
import { alternarResena } from "@/features/comunidad/resenas";
import { requireRol } from "@/lib/auth";
import { formatearFechaHora } from "@/lib/formato";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Reseñas" };

// HU-24 · Moderación de reseñas: las ocultas no se publican ni cuentan en el promedio
export default async function AdminResenasPage() {
  await requireRol("administrador");
  const resenas = await listarResenasAdmin();
  const ocultas = resenas.filter((r) => r.oculta).length;

  return (
    <div className="space-y-6">
      <EncabezadoPagina
        eyebrow="Comunidad"
        titulo="Reseñas"
        descripcion={`Calificaciones de quienes completaron un curso.${ocultas ? ` ${ocultas} oculta(s) por moderación.` : ""}`}
      />
      {resenas.length ? (
        <PanelTabla>
          <table className={cn(tabla.table, "min-w-245")}>
            <thead className={tabla.thead}>
              <tr>
                <th className={tabla.th}>Curso y estudiante</th>
                <th className={tabla.th}>Calificación</th>
                <th className={tabla.th}>Reseña</th>
                <th className={tabla.th}>Fecha</th>
                <th className={cn(tabla.th, "text-right")}>Moderación</th>
              </tr>
            </thead>
            <tbody>
              {resenas.map((r) => (
                <tr key={r.id} className={cn(tabla.tr, r.oculta && "opacity-70")}>
                  <td className={tabla.td}>
                    <p className="font-medium">{r.curso}</p>
                    <p className="text-xs text-muted-foreground">{r.estudiante || "—"}</p>
                  </td>
                  <td className={tabla.td}>
                    <Estrellas valor={r.estrellas} className="text-sm" />
                  </td>
                  <td className={cn(tabla.td, "max-w-md text-sm break-words whitespace-pre-line text-muted-foreground")}>{r.texto ?? "Sin texto"}</td>
                  <td className={cn(tabla.td, "font-mono text-xs whitespace-nowrap")}>{formatearFechaHora(r.fecha)}</td>
                  <td className={cn(tabla.td, "text-right whitespace-nowrap")}>
                    {r.oculta && (
                      <Pildora color="ambar" className="mr-2">
                        Oculta
                      </Pildora>
                    )}
                    <BotonAccion
                      accion={alternarResena}
                      campos={{ id: r.id, oculta: String(!r.oculta) }}
                      confirmar={r.oculta ? undefined : "¿Ocultar esta reseña? Dejará de publicarse y de contar en el promedio."}
                      variant={r.oculta ? "outline" : "ghost"}
                      size="sm"
                    >
                      {r.oculta ? "Mostrar" : "Ocultar"}
                    </BotonAccion>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </PanelTabla>
      ) : (
        <EstadoVacio icono={StarIcon} titulo="Aún no hay reseñas" descripcion="Los estudiantes califican el curso cuando lo completan." />
      )}
    </div>
  );
}
