import { NextResponse, type NextRequest } from "next/server";
import { obtenerEncuestaAdmin, resultadosDeEncuesta } from "@/features/encuestas/consultas";
import { resultadosAExcel } from "@/features/encuestas/exportar";
import { registrarActividad } from "@/lib/auditoria";
import { getUsuarioActual } from "@/lib/auth";
import { TIPO_XLSX } from "@/lib/excel";
import { hoyISO } from "@/lib/formato";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** HU-43 · GET /admin/encuestas/<id>/exportar?curso=<uuid>: resultados de la encuesta en Excel. */
export async function GET(request: NextRequest, ctx: RouteContext<"/admin/encuestas/[id]/exportar">) {
  const usuario = await getUsuarioActual();
  if (usuario?.rol !== "administrador") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const id = Number((await ctx.params).id);
  const encuesta = Number.isInteger(id) && id > 0 ? await obtenerEncuestaAdmin(id) : null;
  if (!encuesta) return NextResponse.json({ error: "Encuesta no encontrada" }, { status: 404 });

  const curso = request.nextUrl.searchParams.get("curso");
  const cursoId = curso && UUID.test(curso) ? curso : undefined;
  const datos = await resultadosDeEncuesta(encuesta.id, encuesta.preguntas, cursoId);
  const contenido = await resultadosAExcel({
    titulo: encuesta.titulo,
    curso: cursoId ? (datos.envios[0]?.curso ?? null) : null,
    preguntas: encuesta.preguntas,
    ...datos,
  });
  await registrarActividad(usuario.id, "EXPORTAR_ENCUESTA", { encuesta: encuesta.id, curso: cursoId ?? null });

  return new NextResponse(new Uint8Array(contenido), {
    headers: {
      "Content-Type": TIPO_XLSX,
      "Content-Disposition": `attachment; filename="encuesta-${encuesta.id}-${hoyISO()}.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
}
