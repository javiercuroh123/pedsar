import "server-only";
import { createClient } from "@/lib/supabase/server";
import { uno } from "@/features/academico/consultas";
import type { MetodoPago, Modalidad } from "@/types/dominio";

export interface FilaReporte {
  cursoId: string;
  titulo: string;
  modalidad: Modalidad;
  cupo: number;
  inscritos: number;
  confirmados: number;
  ingresos: number;
  porMetodo: Partial<Record<MetodoPago, number>>;
}

/** HU-20 / HU-42 · Inscripciones e ingresos por curso en un rango de fechas. */
export async function reporteInscripciones(desde: string, hasta: string, cursoId?: string): Promise<FilaReporte[]> {
  const supabase = await createClient();
  let cursos = supabase.from("cursos").select("id, titulo, modalidad, cupo_maximo").order("titulo");
  if (cursoId) cursos = cursos.eq("id", cursoId);
  let ins = supabase
    .from("inscripciones")
    .select("curso_id, estado, pagos(monto, metodo, estado)")
    .gte("fecha_inscripcion", `${desde}T00:00:00-05:00`)
    .lte("fecha_inscripcion", `${hasta}T23:59:59-05:00`);
  if (cursoId) ins = ins.eq("curso_id", cursoId);

  const [{ data: listaCursos }, { data: listaIns }] = await Promise.all([cursos, ins]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filas = (listaIns ?? []) as any[];

  return ((listaCursos ?? []) as { id: string; titulo: string; modalidad: Modalidad; cupo_maximo: number }[])
    .map((c) => {
      const propias = filas.filter((f) => f.curso_id === c.id && f.estado !== "CANCELADA");
      const porMetodo: Partial<Record<MetodoPago, number>> = {};
      let ingresos = 0;
      propias.forEach((f) => {
        const p = uno<{ monto: number; metodo: MetodoPago; estado: string }>(f.pagos);
        if (p?.estado === "APROBADO") {
          ingresos += Number(p.monto);
          porMetodo[p.metodo] = (porMetodo[p.metodo] ?? 0) + Number(p.monto);
        }
      });
      return {
        cursoId: c.id,
        titulo: c.titulo,
        modalidad: c.modalidad,
        cupo: c.cupo_maximo,
        inscritos: propias.length,
        confirmados: propias.filter((f) => f.estado === "CONFIRMADA").length,
        ingresos,
        porMetodo,
      };
    })
    .filter((f) => cursoId || f.inscritos > 0)
    .sort((a, b) => b.ingresos - a.ingresos);
}

export const rangoPorDefecto = (hoy: string) => ({ desde: `${hoy.slice(0, 4)}-01-01`, hasta: hoy });
