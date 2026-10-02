import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, UserRoundXIcon } from "lucide-react";
import { EncabezadoPagina, EstadoVacio } from "@/components/comunes";
import { uno } from "@/features/academico/consultas";
import { obtenerConversacion } from "@/features/comunidad/consultas";
import { Conversacion } from "@/features/comunidad/conversacion";
import { requireRol } from "@/lib/auth";
import { nombreCompleto } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Conversación" };

// HU-19 · Chat con el instructor de un curso en el que el estudiante está matriculado
export default async function EstudianteConversacionPage({ params }: PageProps<"/estudiante/mensajes/[cursoId]">) {
  const usuario = await requireRol("estudiante");
  const { cursoId } = await params;
  const supabase = await createClient();
  const { data: ins } = await supabase
    .from("inscripciones")
    .select("id, curso:cursos(id, titulo, instructor_id)")
    .eq("curso_id", cursoId)
    .eq("estudiante_id", usuario.id)
    .eq("estado", "CONFIRMADA")
    .maybeSingle();
  const curso = uno<{ id: string; titulo: string; instructor_id: string | null }>(ins?.curso);
  if (!ins || !curso) notFound();

  const conversacion = await obtenerConversacion({ cursoId, estudianteId: usuario.id }, usuario.id);
  let instructor = conversacion?.otro ?? null;
  if (!instructor && curso.instructor_id) {
    const { data } = await supabase.rpc("instructores_publicos", { p_ids: [curso.instructor_id] }).maybeSingle();
    instructor = data ? nombreCompleto(data as { nombres: string; apellidos: string }) : "Instructor";
  }

  return (
    <div className="space-y-6">
      <Link href="/estudiante/mensajes" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> Mensajes
      </Link>
      <EncabezadoPagina titulo={instructor ?? "Sin instructor asignado"} descripcion={curso.titulo} />
      {instructor ? (
        <Conversacion conversacionId={conversacion?.id ?? null} cursoId={cursoId} rol="estudiante" otro={instructor} mensajes={conversacion?.mensajes ?? []} />
      ) : (
        <EstadoVacio icono={UserRoundXIcon} titulo="Este curso aún no tiene instructor asignado" descripcion="Podrás escribirle en cuanto PEDSAR lo asigne." />
      )}
    </div>
  );
}
