import "server-only";
import { createClient } from "@/lib/supabase/server";
import { uno } from "@/features/academico/consultas";
import { etiquetaPago } from "@/lib/formato";
import type { MedioPago, MetodoPago, Modalidad } from "@/types/dominio";

export interface FilaReporte {
  cursoId: string;
  titulo: string;
  modalidad: Modalidad;
  cupo: number;
  inscritos: number;
  confirmados: number;
  ingresos: number;
  /** Ingresos por medio de pago, con la etiqueta de etiquetaPago («Culqi · Tarjeta», «Yape»…). */
  porMetodo: Record<string, number>;
}

export interface FilaMes {
  /** AAAA-MM */
  mes: string;
  inscritos: number;
  confirmados: number;
  ingresos: number;
}

export interface ReporteGeneral {
  desde: string;
  hasta: string;
  /** Título del curso filtrado, o null si es de todos los cursos. */
  curso: string | null;
  porCurso: FilaReporte[];
  /** `metodo` es la etiqueta de etiquetaPago. */
  porMetodo: { metodo: string; monto: number }[];
  porMes: FilaMes[];
  totales: { inscritos: number; confirmados: number; ingresos: number };
  /** Indicadores de usuarios (HU-20); son globales aunque se filtre por curso. */
  usuarios: { registrados: number; activos: number; nuevos: number; estudiantes: number; instructores: number };
}

type FilaInscripcion = { curso_id: string; estado: string; fecha_inscripcion: string; pagos: unknown };

/** Mes (AAAA-MM) de un timestamp en hora de Perú. */
const mesDe = (ts: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima", year: "numeric", month: "2-digit" }).format(new Date(ts));

/**
 * HU-20 · RF-10 · Inscripciones e ingresos por curso, método de pago y mes en un rango de
 * fechas, más los indicadores de usuarios. Las inscripciones canceladas no cuentan; los
 * ingresos son los pagos aprobados de las inscripciones del periodo.
 */
export async function generarReporte(desde: string, hasta: string, cursoId?: string): Promise<ReporteGeneral> {
  const supabase = await createClient();
  let cursos = supabase.from("cursos").select("id, titulo, modalidad, cupo_maximo").order("titulo");
  if (cursoId) cursos = cursos.eq("id", cursoId);
  let ins = supabase
    .from("inscripciones")
    .select("curso_id, estado, fecha_inscripcion, pagos(monto, metodo, medio, estado)")
    .neq("estado", "CANCELADA")
    .gte("fecha_inscripcion", `${desde}T00:00:00-05:00`)
    .lte("fecha_inscripcion", `${hasta}T23:59:59-05:00`);
  if (cursoId) ins = ins.eq("curso_id", cursoId);
  const contar = () => supabase.from("perfiles").select("id", { head: true, count: "exact" });

  const [{ data: listaCursos }, { data: listaIns }, registrados, activos, nuevos, estudiantes, instructores] = await Promise.all([
    cursos,
    ins,
    contar(),
    contar().eq("estado", true),
    contar().gte("fecha_registro", `${desde}T00:00:00-05:00`).lte("fecha_registro", `${hasta}T23:59:59-05:00`),
    contar().eq("rol", "estudiante"),
    contar().eq("rol", "instructor"),
  ]);
  const filas = (listaIns ?? []) as FilaInscripcion[];
  const pagoAprobado = (f: FilaInscripcion) => {
    const p = uno<{ monto: number; metodo: MetodoPago; medio: MedioPago | null; estado: string }>(f.pagos);
    return p?.estado === "APROBADO" ? { monto: Number(p.monto), metodo: etiquetaPago(p.metodo, p.medio) } : null;
  };

  const porCurso = (listaCursos ?? [])
    .map((c): FilaReporte => {
      const propias = filas.filter((f) => f.curso_id === c.id);
      const porMetodo: Record<string, number> = {};
      let ingresos = 0;
      propias.forEach((f) => {
        const p = pagoAprobado(f);
        if (p) {
          ingresos += p.monto;
          porMetodo[p.metodo] = (porMetodo[p.metodo] ?? 0) + p.monto;
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
    .sort((a, b) => b.ingresos - a.ingresos || b.inscritos - a.inscritos);

  const metodos = new Map<string, number>();
  const meses = new Map<string, FilaMes>();
  filas.forEach((f) => {
    const mes = mesDe(f.fecha_inscripcion);
    const m = meses.get(mes) ?? { mes, inscritos: 0, confirmados: 0, ingresos: 0 };
    m.inscritos++;
    if (f.estado === "CONFIRMADA") m.confirmados++;
    const p = pagoAprobado(f);
    if (p) {
      m.ingresos += p.monto;
      metodos.set(p.metodo, (metodos.get(p.metodo) ?? 0) + p.monto);
    }
    meses.set(mes, m);
  });

  return {
    desde,
    hasta,
    curso: cursoId ? (listaCursos?.[0]?.titulo ?? null) : null,
    porCurso,
    porMetodo: [...metodos].map(([metodo, monto]) => ({ metodo, monto })).sort((a, b) => b.monto - a.monto),
    porMes: [...meses.values()].sort((a, b) => a.mes.localeCompare(b.mes)),
    totales: {
      inscritos: porCurso.reduce((a, f) => a + f.inscritos, 0),
      confirmados: porCurso.reduce((a, f) => a + f.confirmados, 0),
      ingresos: porCurso.reduce((a, f) => a + f.ingresos, 0),
    },
    usuarios: {
      registrados: registrados.count ?? 0,
      activos: activos.count ?? 0,
      nuevos: nuevos.count ?? 0,
      estudiantes: estudiantes.count ?? 0,
      instructores: instructores.count ?? 0,
    },
  };
}

export const rangoPorDefecto = (hoy: string) => ({ desde: `${hoy.slice(0, 4)}-01-01`, hasta: hoy });

/** Nombre corto del mes, p. ej. «sept. 2026». */
export const etiquetaMes = (mes: string) =>
  new Intl.DateTimeFormat("es-PE", { month: "short", year: "numeric", timeZone: "America/Lima" }).format(new Date(`${mes}-15T12:00:00-05:00`));
