/**
 * Convierte un monto en pesos tal como lo escribe un banco a pesos enteros.
 *
 * Bancolombia usa formatos distintos para el mismo tipo de dato:
 * `$80.000,00`, `$500,000.00`, `$75000.00`, `$55,000`.
 * Regla: si el monto termina en un separador seguido de exactamente 2 dígitos,
 * esos son los centavos; cualquier otro `.` o `,` es separador de miles.
 */
export function parseCopAmount(raw: string): number {
  const cleaned = raw.replace(/[$\s]/g, "");
  const match = /^(\d[\d.,]*?)(?:[.,](\d{2}))?$/.exec(cleaned);
  if (!match) {
    throw new Error(`Monto no reconocido: "${raw}"`);
  }

  const [, integerPart, cents = "00"] = match;
  const pesos = Number(integerPart.replace(/[.,]/g, ""));
  if (!Number.isSafeInteger(pesos)) {
    throw new Error(`Monto no reconocido: "${raw}"`);
  }

  // Los montos se guardan en pesos enteros; los centavos se redondean.
  return pesos + Math.round(Number(cents) / 100);
}
