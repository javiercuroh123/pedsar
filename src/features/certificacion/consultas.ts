import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface CertificadoVerificado {
  codigo_unico: string;
  estudiante: string;
  curso: string;
  duracion_horas: number;
  fecha_emision: string;
}

/** Verificación pública del certificado por su código (HU-11). */
export async function verificarCertificado(codigo: string): Promise<CertificadoVerificado | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("verificar_certificado", { p_codigo: codigo });
  if (error) throw new Error(`Verificación: ${error.message}`);
  return ((data as CertificadoVerificado[] | null) ?? [])[0] ?? null;
}
