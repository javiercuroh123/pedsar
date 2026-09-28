import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Health check para monitoreo (RNF-03: disponibilidad 99,5 %). */
export async function GET() {
  const supabase = await createClient();
  const { error } = await supabase.from("categorias").select("id", { head: true, count: "exact" });
  return NextResponse.json(
    { estado: error ? "degradado" : "ok", baseDeDatos: !error, fecha: new Date().toISOString() },
    { status: error ? 503 : 200 },
  );
}
