import type { Metadata } from "next";
import Link from "next/link";
import { AwardIcon, DownloadIcon } from "lucide-react";
import { EncabezadoPagina, PanelTabla, Pildora, tabla } from "@/components/comunes";
import { buttonVariants } from "@/components/ui/button";
import { ASISTENCIA_MINIMA, esCertificadoDeAprobacion, evaluarAptitud, NOTA_MINIMA } from "@/config/academico";
import { uno } from "@/features/academico/consultas";
import { EmisionCertificados, type Candidato } from "@/features/administracion/emision-certificados";
import { obtenerResultados } from "@/features/certificacion/consultas";
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
      .select("id, estudiante:perfiles(nombres, apellidos, correo), curso:cursos(titulo), certificados(id)")
      .eq("estado", "CONFIRMADA"),
    supabase
      .from("certificados")
      .select("id, codigo_unico, fecha_emision, estudiante_nombre, curso_titulo, nota_final, motivo_excepcion")
      .order("fecha_emision", { ascending: false })
      .limit(50),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sinCertificado = ((confirmadas ?? []) as any[]).filter((i) => !uno(i.certificados));
  const resultados = await obtenerResultados(sinCertificado.map((i) => i.id));
  const candidatos: Candidato[] = sinCertificado
    .map((i) => {
      const e = uno<Persona>(i.estudiante);
      const r = resultados.get(i.id);
      return {
        inscripcionId: i.id,
        estudiante: nombreCompleto(e) || e?.correo || "—",
        curso: uno<{ titulo: string }>(i.curso)?.titulo ?? "",
        resultado: r ?? null,
        ...evaluarAptitud(r),
      };
    })
    // Primero los aptos; luego por avance.
    .sort((a, b) => Number(b.apto) - Number(a.apto) || (b.resultado?.progreso ?? 0) - (a.resultado?.progreso ?? 0));

  return (
    <div className="space-y-6">
      <EncabezadoPagina
        eyebrow="Académico"
        titulo="Certificados digitales"
        descripcion={`Se emiten a quienes rinden todas las evaluaciones con nota final ≥ ${NOTA_MINIMA} y asisten al ${ASISTENCIA_MINIMA} % de las sesiones.`}
      />
      <EmisionCertificados candidatos={candidatos} />
      <PanelTabla titulo="Emitidos recientemente">
        {(emitidos ?? []).length ? (
          <table className={tabla.table}>
            <thead className={tabla.thead}>
              <tr>
                <th className={tabla.th}>Código</th>
                <th className={tabla.th}>Estudiante</th>
                <th className={tabla.th}>Curso</th>
                <th className={tabla.th}>Nota</th>
                <th className={tabla.th}>Emisión</th>
                <th className={tabla.th} />
              </tr>
            </thead>
            <tbody>
              {(emitidos ?? []).map((c) => (
                <tr key={c.id} className={tabla.tr}>
                  <td className={cn(tabla.td, "font-mono text-xs")}>{c.codigo_unico}</td>
                  <td className={cn(tabla.td, "font-medium")}>
                    {c.estudiante_nombre}
                    {c.motivo_excepcion && (
                      <span className="mt-1 block" title={c.motivo_excepcion}>
                        <Pildora color="ambar">Excepción</Pildora>
                      </span>
                    )}
                  </td>
                  <td className={cn(tabla.td, "text-muted-foreground")}>{c.curso_titulo}</td>
                  <td className={cn(tabla.td, "font-mono text-xs")}>
                    {c.nota_final !== null ? `${Number(c.nota_final).toFixed(1)}/20` : "—"}
                    {!esCertificadoDeAprobacion(c.nota_final === null ? null : Number(c.nota_final)) && (
                      <span className="block font-sans text-muted-foreground">Participación</span>
                    )}
                  </td>
                  <td className={cn(tabla.td, "whitespace-nowrap text-muted-foreground")}>{formatearFecha(c.fecha_emision)}</td>
                  <td className={cn(tabla.td, "text-right whitespace-nowrap")}>
                    <a href={`/certificados/${c.codigo_unico}/pdf`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                      <DownloadIcon /> PDF
                    </a>
                    <Link href={`/verificar?codigo=${c.codigo_unico}`} target="_blank" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                      Verificar
                    </Link>
                  </td>
                </tr>
              ))}
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
