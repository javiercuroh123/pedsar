import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { obtenerCursoPorSlug } from "@/features/catalogo/consultas";
import { FormularioInscripcion } from "@/features/matricula/formulario-inscripcion";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ETIQUETA_MODALIDAD, formatearFecha, formatearHora, hoyISO } from "@/lib/formato";

export const metadata: Metadata = { title: "Inscripción" };

// HU-07 · Inscripción · HU-12 · Pagos en línea · HU-32 · Cupones
export default async function InscripcionPage({ params }: PageProps<"/cursos/[slug]/inscripcion">) {
  const usuario = await requireRol("estudiante"); // sin sesión → /login
  const { slug } = await params;
  const curso = await obtenerCursoPorSlug(slug);
  if (!curso) notFound();
  if (curso.cupo_disponible <= 0) redirect(`/cursos/${slug}`);

  const supabase = await createClient();
  const { data: perfil } = await supabase.from("perfiles").select("telefono, documento").eq("id", usuario.id).single();

  const inicio = curso.sesiones.find((s) => s.fecha >= hoyISO()) ?? curso.sesiones[0];

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-linear-to-b from-brand-50 to-transparent dark:from-brand-950/50" />
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <Link href={`/cursos/${curso.slug}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeftIcon className="size-4" /> Volver al curso
        </Link>
        <h1 className="animar-entrada mt-4 text-[1.875rem] font-semibold tracking-tight">Completa tu inscripción</h1>
        <FormularioInscripcion
          curso={{
            id: curso.id,
            titulo: curso.titulo,
            precio: curso.precio,
            categoria: curso.categoria?.slug ?? null,
            resumen: `${ETIQUETA_MODALIDAD[curso.modalidad]} · ${curso.duracion_horas} h${inicio ? ` · Inicia ${formatearFecha(inicio.fecha)}` : ""}`,
            horario: inicio ? `Primera sesión a las ${formatearHora(inicio.hora_inicio)}` : "Horario por confirmar",
          }}
          perfil={{
            nombres: usuario.nombres,
            apellidos: usuario.apellidos,
            correo: usuario.correo,
            telefono: perfil?.telefono ?? null,
            documento: perfil?.documento ?? null,
          }}
          cupoLibre={curso.cupo_disponible}
          cupoMaximo={curso.cupo_maximo}
        />
      </div>
    </div>
  );
}
