import { NextResponse, type NextRequest } from "next/server";
import { rangoPorDefecto, reporteInscripciones } from "@/features/administracion/reportes";
import { registrarActividad } from "@/lib/auditoria";
import { getUsuarioActual } from "@/lib/auth";
import { ETIQUETA_METODO, ETIQUETA_MODALIDAD, hoyISO } from "@/lib/formato";
import type { MetodoPago } from "@/types/dominio";

const fecha = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const celda = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;

/**
 * HU-42 · Exportación del reporte en CSV compatible con Excel
 * (separador ";" y BOM UTF-8 para que Excel en español respete las tildes).
 */
export async function GET(request: NextRequest) {
  const usuario = await getUsuarioActual();
  if (usuario?.rol !== "administrador") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const sp = request.nextUrl.searchParams;
  const def = rangoPorDefecto(hoyISO());
  const desde = fecha(sp.get("desde")) ?? def.desde;
  const hasta = fecha(sp.get("hasta")) ?? def.hasta;
  const filas = await reporteInscripciones(desde, hasta, sp.get("curso") || undefined);

  const metodos = Object.keys(ETIQUETA_METODO) as MetodoPago[];
  const lineas = [
    ["Curso", "Modalidad", "Cupo", "Inscritos", "Confirmados", "Ocupación %", "Ingresos (S/)", ...metodos.map((m) => ETIQUETA_METODO[m])],
    ...filas.map((f) => [
      f.titulo,
      ETIQUETA_MODALIDAD[f.modalidad],
      f.cupo,
      f.inscritos,
      f.confirmados,
      Math.round((f.inscritos / f.cupo) * 100),
      f.ingresos.toFixed(2),
      ...metodos.map((m) => (f.porMetodo[m] ?? 0).toFixed(2)),
    ]),
  ];
  const csv = "﻿" + lineas.map((l) => l.map(celda).join(";")).join("\r\n");

  await registrarActividad(usuario.id, "EXPORTAR_REPORTE", { desde, hasta });
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="reporte-inscripciones-${desde}_${hasta}.csv"`,
    },
  });
}
