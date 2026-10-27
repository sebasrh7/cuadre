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

/**
 * Monto del extracto de Bancolombia → centavos con signo. El extracto usa
 * formato estadounidense (`-99,999.99`) y omite el cero inicial (`.45`, `-.12`).
 * Se devuelven centavos y no pesos para poder sumar los intereses diarios
 * antes de redondear.
 */
export function parseStatementCents(raw: string): number {
  const match = /^(-)?(\d{1,3}(?:,\d{3})*)?\.(\d{2})$/.exec(raw.trim());
  if (!match) {
    throw new Error(`Monto no reconocido: "${raw}"`);
  }
  const [, sign, integerPart = "0", cents] = match;
  const value = Number(integerPart.replace(/,/g, "")) * 100 + Number(cents);
  if (!Number.isSafeInteger(value)) {
    throw new Error(`Monto no reconocido: "${raw}"`);
  }
  return sign ? -value : value;
}

/** Centavos → pesos enteros, redondeando la mitad hacia arriba en valor absoluto. */
export function centsToPesos(cents: number): number {
  return Math.sign(cents) * Math.round(Math.abs(cents) / 100);
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
