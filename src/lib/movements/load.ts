import "server-only";
import { createHash } from "node:crypto";
import type { requireUser } from "@/lib/auth";
import { matchAlertsToStatement } from "./alert-import";
import type { OwnIdentity } from "./own-transfer";

type Supabase = Awaited<ReturnType<typeof requireUser>>["supabase"];

/** Lo que el usuario registró como suyo en el onboarding. */
export async function loadOwnIdentity(supabase: Supabase): Promise<OwnIdentity> {
  const [aliases, accounts] = await Promise.all([
    supabase.from("own_aliases").select("kind, value"),
    supabase.from("own_accounts").select("last4"),
  ]);
  return {
    names: (aliases.data ?? []).filter((a) => a.kind === "name").map((a) => a.value),
    keys: (aliases.data ?? []).filter((a) => a.kind === "key").map((a) => a.value),
    accountsLast4: [...new Set((accounts.data ?? []).map((a) => a.last4))],
  };
}

/** Solo se guarda el hash: la clave incluye nombres y descripciones. */
export function dedupeHash(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/**
 * Cuando llega el extracto, sus movimientos reemplazan a los que habían entrado
 * por alerta en el mismo periodo. La categoría que el usuario o la IA ya le
 * habían puesto a la alerta pasa al movimiento del extracto.
 */
export async function replaceAlertsWithStatement(supabase: Supabase, from: string, to: string): Promise<number> {
  const [alerts, statement] = await Promise.all([
    supabase
      .from("movements")
      .select("id, occurred_on, amount_cop, direction, category")
      .eq("source", "alert")
      .gte("occurred_on", shiftDays(from, -1))
      .lte("occurred_on", shiftDays(to, 1)),
    supabase
      .from("movements")
      .select("id, occurred_on, amount_cop, direction, category")
      .eq("source", "statement")
      .gte("occurred_on", shiftDays(from, -1))
      .lte("occurred_on", shiftDays(to, 1)),
  ]);
  if (alerts.error || statement.error || !alerts.data.length) return 0;

  const toMatchable = (m: (typeof alerts.data)[number]) => ({
    id: m.id,
    occurredOn: m.occurred_on,
    amountCop: m.amount_cop,
    direction: m.direction as "in" | "out",
  });
  const pairs = matchAlertsToStatement(alerts.data.map(toMatchable), statement.data.map(toMatchable));

  let replaced = 0;
  for (const { alertId, statementId } of pairs) {
    const alertCategory = alerts.data.find((a) => a.id === alertId)?.category;
    const statementRow = statement.data.find((s) => s.id === statementId);
    if (alertCategory && !statementRow?.category) {
      await supabase.from("movements").update({ category: alertCategory }).eq("id", statementId);
    }
    const { error } = await supabase.from("movements").delete().eq("id", alertId).eq("source", "alert");
    if (!error) replaced++;
  }
  return replaced;
}

export function shiftDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
