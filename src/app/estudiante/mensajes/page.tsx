import type { Metadata } from "next";
import { MessagesSquareIcon } from "lucide-react";
import { EncabezadoPagina, EstadoVacio } from "@/components/comunes";
import { listarConversacionesEstudiante } from "@/features/comunidad/consultas";
import { ListaConversaciones } from "@/features/comunidad/lista-conversaciones";
import { requireRol } from "@/lib/auth";

export const metadata: Metadata = { title: "Mensajes" };

// HU-19 · Comunicación con los instructores
export default async function EstudianteMensajesPage() {
  const usuario = await requireRol("estudiante");
  const conversaciones = await listarConversacionesEstudiante(usuario.id);

  return (
    <div className="space-y-6">
      <EncabezadoPagina eyebrow="Aprendizaje" titulo="Mensajes" descripcion="Escribe a los instructores de tus cursos. Solo tú y el instructor ven la conversación." />
      {conversaciones.length ? (
        <ListaConversaciones items={conversaciones} href={(c) => `/estudiante/mensajes/${c.cursoId}`} />
      ) : (
        <EstadoVacio icono={MessagesSquareIcon} titulo="Aún no tienes cursos confirmados" descripcion="Cuando tu matrícula esté confirmada podrás escribir al instructor del curso." />
      )}
    </div>
  );
}
