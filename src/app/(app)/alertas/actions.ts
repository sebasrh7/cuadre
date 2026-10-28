"use server";

import { z } from "zod";
import { requireConsentedUser } from "@/lib/auth";
import { categorizePendingExpenses } from "@/lib/categories/apply";
import { matchAlertsToStatement, planAlertImport } from "@/lib/movements/alert-import";
import { dedupeHash, loadOwnIdentity, shiftDays } from "@/lib/movements/load";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const base = {
  amountCop: z.number().int().positive().safe(),
  date: isoDate,
  time: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  accountLast4: z.string().regex(/^\d{4}$/),
};
const text = z.string().trim().min(1).max(120);

// Llegan alertas ya leídas en el navegador: el texto crudo nunca sale del equipo.
const alertSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("card_purchase"), ...base, merchant: text, cardType: z.enum(["debit", "credit"]) }),
  z.object({ kind: z.literal("transfer_out_key"), ...base, counterpartyName: text, counterpartyKey: text }),
  z.object({ kind: z.literal("transfer_out_account"), ...base, counterpartyAccountLast4: z.string().regex(/^\d{4}$/) }),
  z.object({ kind: z.literal("transfer_in"), ...base, counterpartyName: text, receivingKey: text }),
]);

export type SaveAlertsResult =
  | { ok: true; inserted: number; duplicates: number; alreadyInStatement: number; categorized: number }
  | { ok: false; error: string };

export async function saveAlerts(input: unknown): Promise<SaveAlertsResult> {
  const parsed = z.array(alertSchema).min(1).max(500).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Las alertas no son válidas." };

  const { supabase, userId, profile } = await requireConsentedUser();
  const planned = planAlertImport(parsed.data, await loadOwnIdentity(supabase));

  // Lo que ya está en un extracto importado no se vuelve a agregar.
  const dates = planned.map((m) => m.occurredOn).sort();
  const { data: statementRows } = await supabase
    .from("movements")
    .select("id, occurred_on, amount_cop, direction")
    .eq("source", "statement")
    .gte("occurred_on", shiftDays(dates[0], -1))
    .lte("occurred_on", shiftDays(dates.at(-1)!, 1));
  const covered = new Set(
    matchAlertsToStatement(
      planned.map((m, i) => ({ id: String(i), occurredOn: m.occurredOn, amountCop: m.amountCop, direction: m.direction })),
      (statementRows ?? []).map((s) => ({
        id: s.id,
        occurredOn: s.occurred_on,
        amountCop: s.amount_cop,
        direction: s.direction as "in" | "out",
      })),
    ).map((p) => Number(p.alertId)),
  );
  const toSave = planned.filter((_, i) => !covered.has(i));

  let inserted = 0;
  if (toSave.length) {
    const { data, error } = await supabase
      .from("movements")
      .upsert(
        toSave.map((m) => ({
          user_id: userId,
          occurred_on: m.occurredOn,
          occurred_at_time: m.occurredAtTime,
          amount_cop: m.amountCop,
          direction: m.direction,
          kind: m.kind,
          counterparty: m.counterparty,
          category: m.category,
          account_last4: m.accountLast4,
          source: "alert",
          dedupe_hash: dedupeHash(m.dedupeKey),
        })),
        { onConflict: "user_id,dedupe_hash", ignoreDuplicates: true },
      )
      .select("id");
    if (error) return { ok: false, error: "No pudimos guardar las alertas. Inténtalo de nuevo." };
    inserted = data?.length ?? 0;
  }

  const categories = await categorizePendingExpenses(supabase, profile.ai_categorization).catch(() => null);
  return {
    ok: true,
    inserted,
    duplicates: toSave.length - inserted,
    alreadyInStatement: covered.size,
    categorized: categories?.categorized ?? 0,
  };
}
