/**
 * Convierte un monto en pesos tal como lo escribe un banco a pesos enteros.
 *
 * Bancolombia usa formatos distintos para el mismo tipo de dato:
 * `$80.000,00`, `$500,000.00`, `$75000.00`, `$55,000`.
 * Regla: si el monto termina en un separador seguido de 1 o 2 dígitos,
 * esos son los decimales; cualquier otro `.` o `,` es separador de miles.
 */
export function parseCopAmount(raw: string): number {
  const { units, cents } = splitAmount(raw);
  // Los montos se guardan en pesos enteros; los centavos se redondean.
  return units + Math.round(cents / 100);
}

/**
 * Convierte un monto en moneda extranjera (`1.500,50`, `1,500.50`, `1500.5`)
 * a centavos enteros, con la misma regla de separadores que `parseCopAmount`.
 */
export function parseMinorAmount(raw: string): number {
  const { units, cents } = splitAmount(raw);
  const minor = units * 100 + cents;
  if (!Number.isSafeInteger(minor)) {
    throw new Error(`Monto no reconocido: "${raw}"`);
  }
  return minor;
}

function splitAmount(raw: string): { units: number; cents: number } {
  const cleaned = raw.replace(/[$\s]/g, "");
  const match = /^(\d[\d.,]*?)(?:[.,](\d{1,2}))?$/.exec(cleaned);
  if (!match) {
    throw new Error(`Monto no reconocido: "${raw}"`);
  }

  const [, integerPart, decimals = "00"] = match;
  const units = Number(integerPart.replace(/[.,]/g, ""));
  if (!Number.isSafeInteger(units)) {
    throw new Error(`Monto no reconocido: "${raw}"`);
  }

  return { units, cents: Number(decimals.padEnd(2, "0")) };
}
