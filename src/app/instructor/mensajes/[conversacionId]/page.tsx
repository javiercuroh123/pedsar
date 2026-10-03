import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { EncabezadoPagina } from "@/components/comunes";
import { obtenerConversacion } from "@/features/comunidad/consultas";
import { Conversacion } from "@/features/comunidad/conversacion";
import { requireRol } from "@/lib/auth";

export const metadata: Metadata = { title: "Conversación" };

// HU-19 · Respuesta del instructor (RLS: solo las conversaciones de sus cursos)
export default async function InstructorConversacionPage({ params }: PageProps<"/instructor/mensajes/[conversacionId]">) {
  const usuario = await requireRol("instructor");
  const id = Number((await params).conversacionId);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const conversacion = await obtenerConversacion({ id }, usuario.id);
  if (!conversacion) notFound();

  return (
    <div className="space-y-6">
      <Link href="/instructor/mensajes" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> Mensajes
      </Link>
      <EncabezadoPagina titulo={conversacion.otro} descripcion={conversacion.curso} />
      <Conversacion conversacionId={conversacion.id} cursoId={conversacion.cursoId} rol="instructor" otro={conversacion.otro} mensajes={conversacion.mensajes} />
    </div>
  );
}
