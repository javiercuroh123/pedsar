import { NextResponse, type NextRequest } from "next/server";
import { reporteAExcel, reporteAPdf } from "@/features/administracion/exportar-reporte";
import { generarReporte, rangoPorDefecto } from "@/features/administracion/reportes";
import { registrarActividad } from "@/lib/auditoria";
import { getUsuarioActual } from "@/lib/auth";
import { TIPO_XLSX } from "@/lib/excel";
import { hoyISO } from "@/lib/formato";

const fecha = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * RF-10 · Exportación del reporte del administrador:
 * GET /admin/reportes/exportar?formato=xlsx|pdf&desde=AAAA-MM-DD&hasta=AAAA-MM-DD&curso=<uuid>
 */
export async function GET(request: NextRequest) {
  const usuario = await getUsuarioActual();
  if (usuario?.rol !== "administrador") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const sp = request.nextUrl.searchParams;
  const def = rangoPorDefecto(hoyISO());
  const desde = fecha(sp.get("desde")) ?? def.desde;
  const hasta = fecha(sp.get("hasta")) ?? def.hasta;
  const curso = sp.get("curso");
  const formato = sp.get("formato") === "pdf" ? "pdf" : "xlsx";
  const reporte = await generarReporte(desde, hasta, curso && UUID.test(curso) ? curso : undefined);

  const nombre = `reporte-pedsar-${desde}_${hasta}.${formato}`;
  const contenido = formato === "pdf" ? Buffer.from(await reporteAPdf(reporte)) : await reporteAExcel(reporte);
  await registrarActividad(usuario.id, "EXPORTAR_REPORTE", { formato, desde, hasta, curso: reporte.curso });

  return new NextResponse(new Uint8Array(contenido), {
    headers: {
      "Content-Type": formato === "pdf" ? "application/pdf" : TIPO_XLSX,
      "Content-Disposition": `attachment; filename="${nombre}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
