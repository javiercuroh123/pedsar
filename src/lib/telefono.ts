// Celulares del Perú: 9 dígitos que empiezan con 9 (el prefijo +51 se muestra fijo).
// Se guardan solo los dígitos ("987654321") y se muestran como "987 654 321".

export const CIFRAS_CELULAR = 9;

/** Deja solo los dígitos del número nacional: quita espacios, guiones y el prefijo 51 / +51 si viene pegado. */
export function normalizarCelular(valor: string): string {
  let digitos = valor.replace(/\D/g, "");
  if (digitos.length > CIFRAS_CELULAR && digitos.startsWith("51")) digitos = digitos.slice(2);
  return digitos.slice(0, CIFRAS_CELULAR);
}

/** "987654321" → "987 654 321" (también agrupa números a medio escribir: "9876" → "987 6"). */
export function formatearCelular(valor: string): string {
  return normalizarCelular(valor).replace(/(\d{3})(?=\d)/g, "$1 ");
}

export const celularValido = (digitos: string) => /^9\d{8}$/.test(digitos);

/** Posición del cursor justo después del dígito número `n` dentro del texto formateado. */
export function posicionTrasDigitos(formateado: string, n: number): number {
  if (n <= 0) return 0;
  let vistos = 0;
  for (let i = 0; i < formateado.length; i++) {
    if (/\d/.test(formateado[i]) && ++vistos === n) return i + 1;
  }
  return formateado.length;
}

/** Mensaje de validación para el servidor; null si el valor está vacío o es un celular válido. */
export function errorCelular(valor: string | undefined, { requerido = false } = {}): string | null {
  const texto = (valor ?? "").trim();
  if (!texto) return requerido ? "Ingresa tu número de celular" : null;
  // Solo dígitos y separadores comunes: "abc" o "98x76…" no se aceptan como celular.
  if (/[^\d\s+\-().]/.test(texto)) return "El celular debe tener 9 dígitos y empezar con 9";
  return celularValido(normalizarCelular(texto)) ? null : "El celular debe tener 9 dígitos y empezar con 9";
}
