export interface MatchableInvoice {
  id: string;
  issuedOn: string;
  totalCop: number;
}

export interface MatchableExpense {
  id: string;
  occurredOn: string;
  amountCop: number;
}

/** Algunas tiendas expiden la factura uno o dos días después del cobro. */
export const MAX_DAYS_PAID_BEFORE = 3;
/** Servicios públicos y seguros se pagan semanas después de la fecha de la factura. */
export const MAX_DAYS_PAID_AFTER = 30;

/**
 * Enlaza cada factura con el gasto que la pagó: mismo valor exacto y pago
 * entre 3 días antes y 30 días después de la fecha de la factura. Si hay
 * varias parejas posibles gana la de fechas más cercanas; cada factura y cada
 * gasto se usan una sola vez. La factura no crea ni cambia el gasto: solo lo
 * acompaña como soporte.
 */
export function matchInvoicesToExpenses(
  invoices: MatchableInvoice[],
  expenses: MatchableExpense[],
): { invoiceId: string; movementId: string }[] {
  const candidates: { invoiceId: string; movementId: string; distance: number }[] = [];
  for (const invoice of invoices) {
    for (const expense of expenses) {
      if (expense.amountCop !== invoice.totalCop) continue;
      const daysAfter = Math.round((Date.parse(expense.occurredOn) - Date.parse(invoice.issuedOn)) / 86_400_000);
      if (daysAfter < -MAX_DAYS_PAID_BEFORE || daysAfter > MAX_DAYS_PAID_AFTER) continue;
      candidates.push({ invoiceId: invoice.id, movementId: expense.id, distance: Math.abs(daysAfter) });
    }
  }

  const usedInvoices = new Set<string>();
  const usedMovements = new Set<string>();
  const pairs: { invoiceId: string; movementId: string }[] = [];
  // El orden estable conserva, a igual distancia, el orden en que llegaron.
  for (const { invoiceId, movementId } of candidates.sort((a, b) => a.distance - b.distance)) {
    if (usedInvoices.has(invoiceId) || usedMovements.has(movementId)) continue;
    usedInvoices.add(invoiceId);
    usedMovements.add(movementId);
    pairs.push({ invoiceId, movementId });
  }
  return pairs;
}
