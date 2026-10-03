import { describe, expect, it, vi } from "vitest";
import { aprobado, esCertificadoDeAprobacion, evaluarAptitud, formatearAsistencia, formatearNota, type ResultadoAcademico } from "@/config/academico";
import { PLAZO_PAGO_HORAS, reservaVencida } from "@/config/matricula";
import { INICIO_POR_ROL, NAV_POR_ROL, RUTAS_PROTEGIDAS } from "@/config/navegacion";

const resultado = (r: Partial<ResultadoAcademico> = {}): ResultadoAcademico => ({
  inscripcion_id: "i1",
  evaluaciones: 2,
  rendidas: 2,
  nota_final: 15,
  sesiones: 4,
  presentes: 4,
  asistencia: 100,
  contenidos: 10,
  completados: 3,
  progreso: 30,
  ...r,
});

describe("requisitos de aprobación (HU-11)", () => {
  it("aprueba con 13/20 en escala proporcional al puntaje total", () => {
    expect(aprobado(13, 20)).toBe(true);
    expect(aprobado(12.99, 20)).toBe(false);
    expect(aprobado(65, 100)).toBe(true);
    expect(aprobado(5, 0)).toBe(false);
  });

  it("el certificado es de aprobación solo con nota final ≥ 13", () => {
    expect(esCertificadoDeAprobacion(13)).toBe(true);
    expect(esCertificadoDeAprobacion(12.5)).toBe(false);
    expect(esCertificadoDeAprobacion(null)).toBe(false);
    expect(esCertificadoDeAprobacion(undefined)).toBe(false);
  });

  it("es apto con todas las evaluaciones, nota ≥ 13 y asistencia ≥ 75 %; el avance es informativo", () => {
    expect(evaluarAptitud(resultado({ nota_final: 13, asistencia: 75, progreso: 0 }))).toEqual({ apto: true, motivos: [] });
  });

  it("exige rendir todas las evaluaciones antes de mirar la nota", () => {
    const r = evaluarAptitud(resultado({ evaluaciones: 3, rendidas: 1, nota_final: 6 }));
    expect(r.apto).toBe(false);
    expect(r.motivos).toEqual(["Faltan rendir 2 de 3 evaluaciones"]);
  });

  it("informa la nota final insuficiente y la asistencia insuficiente a la vez, sin redondear hacia el mínimo", () => {
    const r = evaluarAptitud(resultado({ nota_final: 12.96, asistencia: 74.6 }));
    expect(r.motivos).toEqual(["Nota final 12.9/20 (mínimo 13)", "Asistencia 74 % (mínimo 75 %)"]);
  });

  it("muestra nota y asistencia truncadas: la cifra visible aprueba solo si la real aprueba", () => {
    expect(formatearNota(12.96)).toBe("12.9");
    expect(formatearNota(13)).toBe("13.0");
    expect(formatearNota(14.3)).toBe("14.3");
    expect(formatearNota(19.99)).toBe("19.9");
    expect(formatearNota(20)).toBe("20.0");
    expect(formatearAsistencia(74.9)).toBe("74");
    expect(formatearAsistencia(75)).toBe("75");
    expect(formatearAsistencia(100)).toBe("100");
    for (let centesimas = 0; centesimas <= 2000; centesimas++) {
      const nota = centesimas / 100;
      expect(Number(formatearNota(nota)) >= 13, `nota ${nota}`).toBe(nota >= 13);
    }
  });

  it("no exige lo que el curso no tiene, pero sí al menos evaluaciones o sesiones", () => {
    expect(evaluarAptitud(resultado({ evaluaciones: 0, rendidas: 0, nota_final: null })).apto).toBe(true);
    expect(evaluarAptitud(resultado({ sesiones: 0, presentes: 0, asistencia: null })).apto).toBe(true);
    expect(evaluarAptitud(resultado({ evaluaciones: 0, rendidas: 0, nota_final: null, sesiones: 0, asistencia: null }))).toEqual({
      apto: false,
      motivos: ["Aún no hay evaluaciones ni sesiones dictadas que acrediten el curso"],
    });
  });

  it("trata la nota o la asistencia nulas como cero", () => {
    expect(evaluarAptitud(resultado({ nota_final: null })).motivos).toEqual(["Nota final 0.0/20 (mínimo 13)"]);
    expect(evaluarAptitud(resultado({ asistencia: null })).motivos).toEqual(["Asistencia 0 % (mínimo 75 %)"]);
  });

  it("sin datos académicos no es apto", () => {
    expect(evaluarAptitud(undefined)).toEqual({ apto: false, motivos: ["Sin datos académicos"] });
  });
});

describe("plazo de la reserva", () => {
  it("es de 48 horas, igual que en la base de datos", () => {
    expect(PLAZO_PAGO_HORAS).toBe(48);
  });

  it("vence solo una inscripción PENDIENTE cuyo plazo ya pasó", () => {
    vi.useFakeTimers({ now: new Date("2026-10-01T15:00:00Z") });
    expect(reservaVencida({ estado: "PENDIENTE", vence_en: "2026-10-01T14:59:59Z" })).toBe(true);
    expect(reservaVencida({ estado: "PENDIENTE", vence_en: "2026-10-01T15:00:00Z" })).toBe(true);
    expect(reservaVencida({ estado: "PENDIENTE", vence_en: "2026-10-01T15:00:01Z" })).toBe(false);
    // En validación (vence_en = null) o ya resuelta, no vence.
    expect(reservaVencida({ estado: "PENDIENTE", vence_en: null })).toBe(false);
    expect(reservaVencida({ estado: "CONFIRMADA", vence_en: "2026-09-01T00:00:00Z" })).toBe(false);
  });
});

describe("navegación por rol", () => {
  it("cada rol tiene su panel y su menú", () => {
    for (const rol of ["administrador", "instructor", "estudiante"] as const) {
      expect(INICIO_POR_ROL[rol]).toMatch(/^\//);
      expect(NAV_POR_ROL[rol].flatMap((g) => g.items).every((i) => i.href.startsWith("/"))).toBe(true);
    }
  });

  it("protege los portales y el PDF de los certificados", () => {
    const prefijos = RUTAS_PROTEGIDAS.map((r) => r.prefijo);
    expect(prefijos).toEqual(expect.arrayContaining(["/admin", "/instructor", "/estudiante", "/cuenta", "/certificados"]));
    expect(RUTAS_PROTEGIDAS.find((r) => r.prefijo === "/admin")?.roles).toEqual(["administrador"]);
  });
});
