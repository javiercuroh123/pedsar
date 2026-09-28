import type { Metadata } from "next";
import Link from "next/link";
import { AwardIcon } from "lucide-react";
import { EncabezadoPagina, PanelTabla, tabla } from "@/components/comunes";
import { buttonVariants } from "@/components/ui/button";
import { calcularProgreso, uno } from "@/features/academico/consultas";
import { EmisionCertificados, type Candidato } from "@/features/administracion/emision-certificados";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatearFecha, nombreCompleto } from "@/lib/formato";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Certificados" };

type Persona = { nombres: string; apellidos: string; correo: string };

// HU-11 · HU-60 · Emisión de certificados digitales
export default async function AdminCertificadosPage() {
  await requireRol("administrador");
  const supabase = await createClient();

  const [{ data: confirmadas }, { data: emitidos }] = await Promise.all([
    supabase
      .from("inscripciones")
      .select("id, curso_id, estudiante:perfiles(nombres, apellidos, correo), curso:cursos(titulo), certificados(id), intentos_evaluacion(puntaje_obtenido, evaluacion:evaluaciones(puntaje_total))")
      .eq("estado", "CONFIRMADA"),
    supabase
      .from("certificados")
      .select("id, codigo_unico, fecha_emision, inscripcion:inscripciones(estudiante:perfiles(nombres, apellidos, correo), curso:cursos(titulo))")
      .order("fecha_emision", { ascending: false })
      .limit(50),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sinCertificado = ((confirmadas ?? []) as any[]).filter((i) => !uno(i.certificados));
  const progreso = await calcularProgreso(sinCertificado.map((i) => ({ inscripcionId: i.id, cursoId: i.curso_id })));
  const candidatos: Candidato[] = sinCertificado
    .map((i) => {
      const e = uno<Persona>(i.estudiante);
      const notas = ((i.intentos_evaluacion ?? []) as { puntaje_obtenido: number; evaluacion: unknown }[]).map((t) => {
        const total = Number(uno<{ puntaje_total: number }>(t.evaluacion)?.puntaje_total ?? 20);
        return (Number(t.puntaje_obtenido ?? 0) / total) * 20;
      });
      return {
        inscripcionId: i.id,
        estudiante: nombreCompleto(e) || e?.correo || "—",
        curso: uno<{ titulo: string }>(i.curso)?.titulo ?? "",
        progreso: progreso.get(i.id)?.porcentaje ?? 0,
        promedio: notas.length ? notas.reduce((a, b) => a + b, 0) / notas.length : null,
      };
    })
    .sort((a, b) => b.progreso - a.progreso);

  return (
    <div className="space-y-6">
      <EncabezadoPagina eyebrow="Académico" titulo="Certificados digitales" descripcion="Emisión individual o masiva con código único de verificación." />
      <EmisionCertificados candidatos={candidatos} />
      <PanelTabla titulo="Emitidos recientemente">
        {(emitidos ?? []).length ? (
          <table className={tabla.table}>
            <thead className={tabla.thead}>
              <tr>
                <th className={tabla.th}>Código</th>
                <th className={tabla.th}>Estudiante</th>
                <th className={tabla.th}>Curso</th>
                <th className={tabla.th}>Emisión</th>
                <th className={tabla.th} />
              </tr>
            </thead>
            <tbody>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {((emitidos ?? []) as any[]).map((c) => {
                const ins = uno<{ estudiante: unknown; curso: unknown }>(c.inscripcion);
                const e = uno<Persona>(ins?.estudiante);
                return (
                  <tr key={c.id} className={tabla.tr}>
                    <td className={cn(tabla.td, "font-mono text-xs")}>{c.codigo_unico}</td>
                    <td className={cn(tabla.td, "font-medium")}>{nombreCompleto(e) || e?.correo}</td>
                    <td className={cn(tabla.td, "text-muted-foreground")}>{uno<{ titulo: string }>(ins?.curso)?.titulo}</td>
                    <td className={cn(tabla.td, "text-muted-foreground")}>{formatearFecha(c.fecha_emision)}</td>
                    <td className={cn(tabla.td, "text-right")}>
                      <Link href={`/verificar?codigo=${c.codigo_unico}`} target="_blank" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                        Verificar
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="flex flex-col items-center px-5 py-10 text-center text-sm text-muted-foreground">
            <AwardIcon className="size-6" />
            <p className="mt-2">Aún no se emitieron certificados.</p>
          </div>
        )}
      </PanelTabla>
    </div>
  );
}
