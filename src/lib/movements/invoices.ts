import "server-only";
import type { requireUser } from "@/lib/auth";
import { MAX_DAYS_PAID_AFTER, MAX_DAYS_PAID_BEFORE, matchInvoicesToExpenses } from "./invoice-match";
import { shiftDays } from "./load";

type Supabase = Awaited<ReturnType<typeof requireUser>>["supabase"];

/**
 * Enlaza las facturas que siguen sueltas con el gasto que las pagó. Se llama
 * al guardar facturas y después de cada importación de movimientos: el gasto
 * puede llegar antes o después que la factura. Devuelve cuántas enlazó.
 */
export async function linkInvoices(supabase: Supabase): Promise<number> {
  const { data: pending, error } = await supabase
    .from("invoices")
    .select("id, issued_on, total_cop")
    .is("movement_id", null)
    .order("issued_on");
  if (error || !pending.length) return 0;

  const [expenses, linked] = await Promise.all([
    supabase
      .from("movements")
      .select("id, occurred_on, amount_cop")
      .eq("kind", "expense")
      .in("amount_cop", [...new Set(pending.map((i) => i.total_cop))])
      .gte("occurred_on", shiftDays(pending[0].issued_on, -MAX_DAYS_PAID_BEFORE))
      .lte("occurred_on", shiftDays(pending.at(-1)!.issued_on, MAX_DAYS_PAID_AFTER))
      .order("occurred_on"),
    supabase.from("invoices").select("movement_id").not("movement_id", "is", null),
  ]);
  if (expenses.error || linked.error) return 0;

  const taken = new Set(linked.data.map((i) => i.movement_id));
  const pairs = matchInvoicesToExpenses(
    pending.map((i) => ({ id: i.id, issuedOn: i.issued_on, totalCop: i.total_cop })),
    expenses.data
      .filter((m) => !taken.has(m.id))
      .map((m) => ({ id: m.id, occurredOn: m.occurred_on, amountCop: m.amount_cop })),
  );

  let count = 0;
  for (const { invoiceId, movementId } of pairs) {
    const { error: failed } = await supabase.from("invoices").update({ movement_id: movementId }).eq("id", invoiceId);
    if (!failed) count++;
  }
  return count;
}
