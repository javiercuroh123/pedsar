import type { Metadata } from "next";
import { MessagesSquareIcon } from "lucide-react";
import { EncabezadoPagina, EstadoVacio } from "@/components/comunes";
import { SelectorUrl } from "@/components/selector-url";
import { listarCursosDelInstructor } from "@/features/academico/consultas-instructor";
import { listarBandejaInstructor } from "@/features/comunidad/consultas";
import { ListaConversaciones } from "@/features/comunidad/lista-conversaciones";
import { requireRol } from "@/lib/auth";

export const metadata: Metadata = { title: "Mensajes" };

// HU-19 · HU-54 · Bandeja unificada de mensajes de los estudiantes
export default async function InstructorMensajesPage({ searchParams }: PageProps<"/instructor/mensajes">) {
  const usuario = await requireRol("instructor");
  const { curso } = await searchParams;
  const cursos = await listarCursosDelInstructor(usuario);
  const filtro = typeof curso === "string" && cursos.some((c) => c.id === curso) ? curso : undefined;
  const bandeja = await listarBandejaInstructor(filtro);
  const sinLeer = bandeja.reduce((a, c) => a + c.noLeidos, 0);

  return (
    <div className="space-y-6">
      <EncabezadoPagina eyebrow="Docencia" titulo="Mensajes" descripcion={sinLeer ? `${sinLeer} mensaje(s) sin leer` : "Consultas de los estudiantes de tus cursos."}>
        {cursos.length > 1 && (
          <SelectorUrl
            param="curso"
            valor={filtro ?? ""}
            etiqueta="Curso"
            opciones={[{ valor: "", etiqueta: "Todos los cursos" }, ...cursos.map((c) => ({ valor: c.id, etiqueta: c.titulo }))]}
            className="w-60"
          />
        )}
      </EncabezadoPagina>
      {bandeja.length ? (
        <ListaConversaciones items={bandeja} href={(c) => `/instructor/mensajes/${c.id}`} />
      ) : (
        <EstadoVacio icono={MessagesSquareIcon} titulo="No tienes mensajes" descripcion="Cuando un estudiante te escriba, su consulta aparecerá aquí." />
      )}
    </div>
  );
}
