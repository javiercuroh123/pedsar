import { NextResponse } from "next/server";
import { registrarActividad } from "@/lib/auditoria";
import { getUsuarioActual } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** HU-44 · Exportación de datos personales (derecho de acceso, Ley N.º 29733). */
export async function GET() {
  const usuario = await getUsuarioActual();
  if (!usuario) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const supabase = await createClient();
  const [{ data: perfil }, { data: inscripciones }, { data: notificaciones }] = await Promise.all([
    supabase.from("perfiles").select("nombres, apellidos, correo, telefono, documento, rol, especialidad, fecha_registro").eq("id", usuario.id).single(),
    supabase
      .from("inscripciones")
      .select("codigo, estado, fecha_inscripcion, curso:cursos(titulo), pagos(monto, metodo, estado, fecha_pago), certificados(codigo_unico, fecha_emision)")
      .eq("estudiante_id", usuario.id),
    supabase.from("notificaciones").select("mensaje, tipo, leida, fecha_envio").eq("usuario_id", usuario.id),
  ]);

  await registrarActividad(usuario.id, "EXPORTAR_DATOS", { formato: "JSON" });
  const cuerpo = JSON.stringify({ generado: new Date().toISOString(), perfil, inscripciones, notificaciones }, null, 2);
  return new NextResponse(cuerpo, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="mis-datos-pedsar.json"`,
    },
  });
}
