/**
 * Un extracto puede cubrir varios meses y llegar después de que vence la PILA
 * de alguno. Para un mes sin extracto el usuario declara cuánto le llegó: queda
 * como un ingreso manual con esta categoría y lo reemplaza el extracto cuando llega.
 */
export const DECLARED_INCOME_CATEGORY = "Ingreso declarado";

/** Un ingreso declarado por mes: la clave evita duplicarlo si se declara dos veces. */
export function declaredIncomeKey(month: string): string {
  return `declared-income|${month}`;
}

/** Último día del mes `YYYY-MM`: la fecha con que se guarda lo declarado. */
export function lastDayOfMonth(month: string): string {
  const [year, m] = month.split("-").map(Number);
  const day = new Date(Date.UTC(year, m, 0)).getUTCDate();
  return `${month}-${String(day).padStart(2, "0")}`;
}

/**
 * Ingresos declarados que un extracto recién importado reemplaza: los de los
 * meses en que el extracto trae algún ingreso. Si el extracto (p. ej. Nequi)
 * no tiene ingresos ese mes, lo declarado se conserva: el ingreso estará en
 * otra cuenta.
 */
export function declaredToReplace(
  declared: { id: string; occurredOn: string }[],
  imported: { occurredOn: string; kind: string }[],
): string[] {
  const monthsWithIncome = new Set(imported.filter((m) => m.kind === "income").map((m) => m.occurredOn.slice(0, 7)));
  return declared.filter((d) => monthsWithIncome.has(d.occurredOn.slice(0, 7))).map((d) => d.id);
}

/** Promedio de los meses completos, redondeado a miles: la sugerencia del formulario. */
export function suggestedIncome(completeMonthIncomes: number[]): number | null {
  if (!completeMonthIncomes.length) return null;
  const average = completeMonthIncomes.reduce((t, v) => t + v, 0) / completeMonthIncomes.length;
  return Math.round(average / 1000) * 1000;
}
