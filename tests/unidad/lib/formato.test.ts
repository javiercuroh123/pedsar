import { describe, expect, it, vi } from "vitest";
import {
  ETIQUETA_ESTADO,
  ETIQUETA_METODO,
  formatearDiaSemana,
  formatearFecha,
  formatearFechaCorta,
  formatearFechaHora,
  formatearHora,
  formatearSoles,
  horaFin,
  hoyISO,
  iniciales,
  nombreCompleto,
  situacionPagoPendiente,
} from "@/lib/formato";

// Intl puede separar con espacios especiales (U+00A0, U+202F): se normalizan para comparar.
const plano = (s: string) => s.replace(/[  ]/g, " ");

describe("formato de montos y fechas (hora de Perú)", () => {
  it("formatea soles", () => {
    expect(plano(formatearSoles(1250.5))).toBe("S/ 1,250.50");
  });

  it("lee las columnas date a mediodía para no cambiar de día", () => {
    expect(plano(formatearFecha("2026-10-01"))).toMatch(/^1 oct\.? 2026$/);
    expect(plano(formatearFechaCorta("2026-10-01"))).toMatch(/^01.oct$/);
    expect(plano(formatearDiaSemana("2026-10-01"))).toMatch(/^jue$/);
  });

  it("muestra los timestamps en hora de Lima aunque el servidor esté en UTC", () => {
    // 03:30 UTC del 2 de octubre = 22:30 del 1 de octubre en Lima.
    expect(plano(formatearFechaHora("2026-10-02T03:30:00Z"))).toMatch(/1 oct\.? 2026.*10:30/);
    expect(plano(formatearFecha(new Date("2026-10-02T03:30:00Z")))).toMatch(/^1 oct/);
  });

  it("hoyISO usa la fecha de Lima", () => {
    vi.useFakeTimers({ now: new Date("2026-10-02T03:30:00Z") });
    expect(hoyISO()).toBe("2026-10-01");
  });

  it("calcula horas", () => {
    expect(formatearHora("09:30:00")).toBe("09:30");
    expect(horaFin("09:30:00", 90)).toBe("11:00");
    expect(horaFin("23:30", 45)).toBe("00:15");
  });
});

describe("nombres", () => {
  it("toma las iniciales de las dos primeras palabras", () => {
    expect(iniciales("ana  maría quispe")).toBe("AM");
    expect(iniciales("   ")).toBe("?");
  });

  it("une nombres y apellidos ignorando vacíos", () => {
    expect(nombreCompleto({ nombres: "Ana", apellidos: "Quispe" })).toBe("Ana Quispe");
    expect(nombreCompleto({ nombres: "Ana", apellidos: null })).toBe("Ana");
    expect(nombreCompleto(null)).toBe("");
  });
});

describe("etiquetas y situación del pago directo", () => {
  it("tiene etiqueta para cada método y estado", () => {
    expect(ETIQUETA_METODO.YAPE).toBe("Yape");
    expect(ETIQUETA_ESTADO.VENCIDO).toBe("Vencido");
  });

  it("indica qué le falta al estudiante, en orden de prioridad", () => {
    const pendiente = { estado: "PENDIENTE", vence_en: "2999-01-01T00:00:00Z" };
    const vencida = { estado: "PENDIENTE", vence_en: "2000-01-01T00:00:00Z" };
    expect(situacionPagoPendiente({ reportado_en: "2026-10-01T10:00:00Z", observacion: null }, vencida).accion).toBe("Ver pago");
    expect(situacionPagoPendiente({ reportado_en: null, observacion: "Captura ilegible" }, vencida).texto).toBe("tu reserva venció");
    expect(situacionPagoPendiente({ reportado_en: null, observacion: "Captura ilegible" }, pendiente).accion).toBe("Corregir pago");
    expect(situacionPagoPendiente({ reportado_en: null, observacion: null }, pendiente).accion).toBe("Registrar pago");
  });
});
