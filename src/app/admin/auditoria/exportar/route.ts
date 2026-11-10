import { type NextRequest, NextResponse } from "next/server";
import { uno } from "@/features/academico/consultas";
import { registrarActividad } from "@/lib/auditoria";
import { getUsuarioActual } from "@/lib/auth";
import { formatearFechaHora, hoyISO, nombreCompleto } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";

const esFecha = (v: string | null): v is string => Boolean(v && /^\d{4}-\d{2}-\d{2}$/.test(v));

/** Escapa una celda CSV y neutraliza prefijos de fórmula (=, +, -, @). */
const celdaCsv = (valor: unknown) => {
  const limpio = String(valor ?? "").replace(/\r?\n/g, " ");
  const seguro = /^[=+\-@]/.test(limpio) ? `'${limpio}` : limpio;
  return `"${seguro.replace(/"/g, '""')}"`;
};

/** HU-61 · Exportación en CSV del registro de actividad (solo administrador). */
export async function GET(request: NextRequest) {
  const usuario = await getUsuarioActual();
  if (!usuario || usuario.rol !== "administrador") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const sp = request.nextUrl.searchParams;
  const texto = (sp.get("q") ?? "").trim().toLowerCase();
  const desde = esFecha(sp.get("desde")) ? sp.get("desde")! : "";
  const hasta = esFecha(sp.get("hasta")) ? sp.get("hasta")! : "";

  const supabase = await createClient();
  let consulta = supabase
    .from("registro_actividad")
    .select("id, accion, detalle, direccion_ip, fecha_hora, usuario:perfiles(nombres, apellidos, correo, rol)")
    .order("fecha_hora", { ascending: false })
    .limit(1000);
  if (desde) consulta = consulta.gte("fecha_hora", `${desde}T00:00:00-05:00`);
  if (hasta) consulta = consulta.lte("fecha_hora", `${hasta}T23:59:59-05:00`);

  const { data } = await consulta;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const eventos = ((data ?? []) as any[]).filter(
    (e) => !texto || `${e.accion} ${JSON.stringify(e.detalle ?? "")} ${JSON.stringify(e.usuario ?? "")}`.toLowerCase().includes(texto),
  );

  const lineas = [
    ["Fecha y hora", "Usuario", "Correo", "Rol", "Acción", "Detalle", "Dirección IP"].map(celdaCsv).join(","),
    ...eventos.map((e) => {
      const u = uno<{ nombres: string; apellidos: string; correo: string; rol: string }>(e.usuario);
      return [
        formatearFechaHora(e.fecha_hora),
        u ? nombreCompleto(u) || u.correo : "Sistema",
        u?.correo ?? "",
        u?.rol ?? "",
        e.accion,
        e.detalle ? JSON.stringify(e.detalle) : "",
        e.direccion_ip ?? "",
      ]
        .map(celdaCsv)
        .join(",");
    }),
  ];

  await registrarActividad(usuario.id, "EXPORTAR_AUDITORIA", { formato: "csv", desde: desde || null, hasta: hasta || null, registros: eventos.length });

  return new NextResponse(`\uFEFF${lineas.join("\r\n")}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="auditoria-pedsar-${hoyISO()}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
