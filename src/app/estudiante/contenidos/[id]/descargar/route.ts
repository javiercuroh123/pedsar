import { NextResponse } from "next/server";
import { z } from "zod";
import { registrarActividad } from "@/lib/auditoria";
import { getUsuarioActual } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * HU-26 · Descarga de materiales educativos con registro de fecha y hora
 * en la bitácora de auditoría. La lectura se realiza con el cliente de sesión
 * para que RLS garantice que el estudiante tiene matrícula confirmada.
 */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await getUsuarioActual();
  if (!usuario) return new NextResponse("No autorizado", { status: 401 });

  const id = z.coerce.number().int().positive().safeParse((await params).id);
  if (!id.success) return new NextResponse("No encontrado", { status: 404 });

  const supabase = await createClient();
  const { data: contenido } = await supabase
    .from("contenidos")
    .select("id, titulo, tipo, url_archivo")
    .eq("id", id.data)
    .maybeSingle();
  if (!contenido) return new NextResponse("No encontrado", { status: 404 });

  let destino: string | null = contenido.url_archivo;
  if (!/^https?:\/\//.test(contenido.url_archivo)) {
    const { data } = await createAdminClient()
      .storage.from("contenidos")
      .createSignedUrl(contenido.url_archivo, 3600);
    destino = data?.signedUrl ?? null;
  }
  if (!destino) return new NextResponse("Recurso no disponible", { status: 404 });

  await registrarActividad(usuario.id, "DESCARGAR_MATERIAL", {
    contenido: contenido.id,
    titulo: contenido.titulo,
    tipo: contenido.tipo,
  });

  return NextResponse.redirect(destino);
}
