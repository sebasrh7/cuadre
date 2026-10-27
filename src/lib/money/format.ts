const cop = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const usd = new Intl.NumberFormat("es-CO", { style: "currency", currency: "USD" });

const rate = new Intl.NumberFormat("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatCop(pesos: number): string {
  return cop.format(pesos);
}

export function formatUsd(cents: number): string {
  return usd.format(cents / 100);
}

/**
 * Tasa efectiva recibida: pesos por cada dólar. Se calcula para mostrarla,
 * nunca se guarda.
 */
export function effectiveRate(pesos: number, usdCents: number): number {
  if (usdCents <= 0) throw new Error("El monto en USD debe ser mayor que cero");
  return (pesos * 100) / usdCents;
}

export function formatRate(value: number): string {
  return rate.format(value);
}
