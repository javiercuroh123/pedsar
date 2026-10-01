import { NextResponse, type NextRequest } from "next/server";
import { listarCursosDelInstructor } from "@/features/academico/consultas-instructor";
import { reporteCursoAExcel, reporteCursoAPdf } from "@/features/academico/exportar-reporte-curso";
import { reporteDelCurso } from "@/features/academico/reporte-instructor";
import { registrarActividad } from "@/lib/auditoria";
import { requireRol } from "@/lib/auth";
import { TIPO_XLSX } from "@/lib/excel";
import { hoyISO } from "@/lib/formato";

/** Nombre de archivo seguro a partir del título del curso. */
const archivo = (titulo: string) =>
  titulo
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50) || "curso";

/**
 * HU-42 · Exportación del reporte académico de un curso:
 * GET /instructor/notas/exportar?curso=<uuid>&formato=xlsx|pdf
 * Solo el instructor del curso (o el administrador) puede exportarlo.
 */
export async function GET(request: NextRequest) {
  const usuario = await requireRol("instructor", "administrador");
  const sp = request.nextUrl.searchParams;
  const curso = (await listarCursosDelInstructor(usuario)).find((c) => c.id === sp.get("curso"));
  if (!curso) return NextResponse.json({ error: "Curso no encontrado" }, { status: 404 });

  const formato = sp.get("formato") === "pdf" ? "pdf" : "xlsx";
  const reporte = await reporteDelCurso(curso);
  const contenido = formato === "pdf" ? Buffer.from(await reporteCursoAPdf(reporte)) : await reporteCursoAExcel(reporte);
  await registrarActividad(usuario.id, "EXPORTAR_REPORTE_CURSO", { formato, curso: curso.id, estudiantes: reporte.estudiantes.length });

  return new NextResponse(new Uint8Array(contenido), {
    headers: {
      "Content-Type": formato === "pdf" ? "application/pdf" : TIPO_XLSX,
      "Content-Disposition": `attachment; filename="reporte-${archivo(curso.titulo)}-${hoyISO()}.${formato}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
