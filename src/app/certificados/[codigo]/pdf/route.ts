import { uno } from "@/features/academico/consultas";
import { generarPdfCertificado } from "@/features/certificacion/pdf-certificado";
import { urlVerificacion } from "@/features/certificacion/qr";
import { requireUsuario } from "@/lib/auth";
import { publicEnv } from "@/lib/env";
import { nombreCompleto } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";

/**
 * HU-11 · Descarga del certificado en PDF: GET /certificados/PED-2026-XXXXXXXX/pdf
 * Se genera al vuelo con los datos congelados al emitirlo. RLS decide quién puede
 * descargarlo: el estudiante dueño, el instructor del curso y el administrador.
 */
export async function GET(_request: Request, ctx: RouteContext<"/certificados/[codigo]/pdf">) {
  await requireUsuario(); // sin sesión → /login
  const codigo = (await ctx.params).codigo.trim().toUpperCase();
  const supabase = await createClient();
  const { data: c } = await supabase
    .from("certificados")
    .select(
      "codigo_unico, fecha_emision, estudiante_nombre, curso_titulo, duracion_horas, instructor_nombre, nota_final, inscripcion:inscripciones(estudiante:perfiles(nombres, apellidos), curso:cursos(titulo, duracion_horas))",
    )
    .eq("codigo_unico", codigo)
    .maybeSingle();
  if (!c) return new Response("Certificado no encontrado", { status: 404 });

  // Certificados anteriores a los datos congelados: se completan con los datos actuales.
  const ins = uno<{ estudiante: unknown; curso: unknown }>(c.inscripcion);
  const curso = uno<{ titulo: string; duracion_horas: number }>(ins?.curso);
  const pdf = await generarPdfCertificado({
    estudiante: c.estudiante_nombre || nombreCompleto(uno(ins?.estudiante)),
    curso: c.curso_titulo || curso?.titulo || "",
    duracion_horas: c.duracion_horas ?? curso?.duracion_horas ?? 0,
    fecha_emision: c.fecha_emision,
    codigo_unico: c.codigo_unico,
    instructor: c.instructor_nombre,
    nota_final: c.nota_final === null ? null : Number(c.nota_final),
    urlVerificacion: urlVerificacion(publicEnv.NEXT_PUBLIC_SITE_URL, c.codigo_unico),
  });

  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="certificado-${c.codigo_unico}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
