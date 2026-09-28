import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardXIcon } from "lucide-react";
import { EstadoVacio } from "@/components/comunes";
import { buttonVariants } from "@/components/ui/button";
import { RendirEvaluacion, type PreguntaPublica } from "@/features/academico/rendir-evaluacion";
import { requireRol } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Evaluación" };

// HU-09 · Rendir evaluación · HU-29 · Calificación automática
export default async function EstudianteEvaluacionPage({ params }: PageProps<"/estudiante/evaluaciones/[id]">) {
  const usuario = await requireRol("estudiante");
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  // Las preguntas solo se leen en el servidor y se envían SIN la respuesta correcta.
  const admin = createAdminClient();
  const { data: evaluacion } = await admin
    .from("evaluaciones")
    .select("id, titulo, curso_id, intentos_permitidos, tiempo_limite_min, curso:cursos(titulo), preguntas(id, enunciado, opciones, puntaje)")
    .eq("id", id)
    .maybeSingle();
  if (!evaluacion) notFound();

  const { data: inscripcion } = await admin
    .from("inscripciones")
    .select("id")
    .eq("curso_id", evaluacion.curso_id)
    .eq("estudiante_id", usuario.id)
    .eq("estado", "CONFIRMADA")
    .maybeSingle();
  if (!inscripcion) notFound();

  const { count } = await admin
    .from("intentos_evaluacion")
    .select("id", { head: true, count: "exact" })
    .eq("inscripcion_id", inscripcion.id)
    .eq("evaluacion_id", id);
  const usados = count ?? 0;

  const preguntas: PreguntaPublica[] = ((evaluacion.preguntas ?? []) as { id: number; enunciado: string; opciones: unknown; puntaje: number }[])
    .sort((a, b) => a.id - b.id)
    .map((p) => ({ id: p.id, enunciado: p.enunciado, opciones: Array.isArray(p.opciones) ? (p.opciones as string[]) : [], puntaje: Number(p.puntaje) }));
  const curso = (Array.isArray(evaluacion.curso) ? evaluacion.curso[0] : evaluacion.curso) as { titulo: string } | null;

  if (usados >= evaluacion.intentos_permitidos || !preguntas.length) {
    return (
      <EstadoVacio
        icono={ClipboardXIcon}
        titulo={preguntas.length ? "Ya usaste todos tus intentos" : "Esta evaluación aún no tiene preguntas"}
        descripcion={preguntas.length ? "Revisa tu nota en la lista de evaluaciones." : "Vuelve más tarde."}
      >
        <Link href="/estudiante/evaluaciones" className={buttonVariants()}>
          Volver a evaluaciones
        </Link>
      </EstadoVacio>
    );
  }

  return (
    <RendirEvaluacion
      evaluacionId={evaluacion.id}
      titulo={evaluacion.titulo}
      curso={curso?.titulo ?? ""}
      preguntas={preguntas}
      tiempoMin={evaluacion.tiempo_limite_min}
      intento={usados + 1}
      intentosPermitidos={evaluacion.intentos_permitidos}
    />
  );
}
