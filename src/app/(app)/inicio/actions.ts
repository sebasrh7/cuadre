"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireConsentedUser } from "@/lib/auth";
import { dedupeHash } from "@/lib/movements/load";
import { DECLARED_INCOME_CATEGORY, declaredIncomeKey, lastDayOfMonth } from "@/lib/movements/declared-income";

const declareSchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  amountCop: z.number().int().min(1).max(10_000_000_000),
});

export type DeclareResult = { ok: true } | { ok: false; error: string };

/**
 * Registra cuánto le llegó al usuario en un mes sin extracto. Reemplaza lo que
 * hubiera declarado antes para ese mes; el extracto lo reemplaza al llegar.
 */
export async function declareMonthIncome(input: z.input<typeof declareSchema>): Promise<DeclareResult> {
  const parsed = declareSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Escribe un monto válido en pesos." };
  const { month, amountCop } = parsed.data;

  const thisMonth = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date()).slice(0, 7);
  if (month > thisMonth) return { ok: false, error: "Ese mes todavía no ha empezado." };

  const { supabase } = await requireConsentedUser();
  const { error } = await supabase.from("movements").upsert(
    {
      occurred_on: lastDayOfMonth(month),
      amount_cop: amountCop,
      direction: "in",
      kind: "income",
      source: "manual",
      counterparty: DECLARED_INCOME_CATEGORY,
      category: DECLARED_INCOME_CATEGORY,
      dedupe_hash: dedupeHash(declaredIncomeKey(month)),
    },
    { onConflict: "user_id,dedupe_hash" },
  );
  if (error) return { ok: false, error: "No pudimos guardarlo. Inténtalo de nuevo." };

  refresh();
  return { ok: true };
}
