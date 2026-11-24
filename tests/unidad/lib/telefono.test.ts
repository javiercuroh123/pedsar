import { describe, expect, it } from "vitest";
import { celularValido, errorCelular, formatearCelular, normalizarCelular, posicionTrasDigitos } from "@/lib/telefono";

describe("celular peruano", () => {
  it("deja solo los dígitos nacionales, sin el prefijo 51 pegado ni letras", () => {
    expect(normalizarCelular("987 654 321")).toBe("987654321");
    expect(normalizarCelular("+51 987-654-321")).toBe("987654321");
    expect(normalizarCelular("51987654321")).toBe("987654321");
    expect(normalizarCelular("9a8b7")).toBe("987");
    // No pasa de 9 cifras.
    expect(normalizarCelular("9876543210")).toBe("987654321");
    // Un número corto que empieza con 51 no se recorta.
    expect(normalizarCelular("519")).toBe("519");
    expect(normalizarCelular("")).toBe("");
  });

  it("agrupa de a tres mientras se escribe", () => {
    expect(formatearCelular("9")).toBe("9");
    expect(formatearCelular("987")).toBe("987");
    expect(formatearCelular("9876")).toBe("987 6");
    expect(formatearCelular("987654321")).toBe("987 654 321");
    expect(formatearCelular("+51987654321")).toBe("987 654 321");
  });

  it("valida 9 dígitos que empiezan con 9", () => {
    expect(celularValido("987654321")).toBe(true);
    expect(celularValido("887654321")).toBe(false);
    expect(celularValido("98765432")).toBe(false);
  });

  it("ubica el cursor después del n-ésimo dígito saltando los espacios", () => {
    expect(posicionTrasDigitos("987 654 321", 0)).toBe(0);
    expect(posicionTrasDigitos("987 654 321", 3)).toBe(3);
    expect(posicionTrasDigitos("987 654 321", 4)).toBe(5);
    expect(posicionTrasDigitos("987 654 321", 9)).toBe(11);
    expect(posicionTrasDigitos("987", 7)).toBe(3);
  });

  it("explica el error al servidor; vacío solo falla si es obligatorio", () => {
    expect(errorCelular("987 654 321")).toBeNull();
    expect(errorCelular(undefined)).toBeNull();
    expect(errorCelular("", { requerido: true })).toBe("Ingresa tu número de celular");
    expect(errorCelular("  ")).toBeNull();
    expect(errorCelular("123")).toBe("El celular debe tener 9 dígitos y empezar con 9");
    expect(errorCelular("abc")).toBe("El celular debe tener 9 dígitos y empezar con 9");
    expect(errorCelular("98765432x1")).toBe("El celular debe tener 9 dígitos y empezar con 9");
    expect(errorCelular("(+51) 987-654-321")).toBeNull();
  });
});
