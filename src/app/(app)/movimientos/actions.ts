"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireConsentedUser } from "@/lib/auth";
import { categorizePendingExpenses, setMerchantCategory, type CategorizeSummary } from "@/lib/categories/apply";
import { EXPENSE_CATEGORIES } from "@/lib/categories/categories";

export async function categorizePending(): Promise<CategorizeSummary> {
  const { supabase, profile } = await requireConsentedUser();
  const summary = await categorizePendingExpenses(supabase, profile.ai_categorization);
  refresh();
  return summary;
}

const incomeSchema = z.object({ id: z.uuid(), isIncome: z.boolean() });

/**
 * Lo recibido de una persona se marca (o desmarca) como ingreso. Solo cambia
 * entre `received` e `income` en movimientos que entran y no tienen categoría:
 * los giros y los intereses no se tocan.
 */
export async function markAsIncome(input: z.input<typeof incomeSchema>) {
  const parsed = incomeSchema.safeParse(input);
  if (!parsed.success) return;
  const { supabase } = await requireConsentedUser();
  await supabase
    .from("movements")
    .update({ kind: parsed.data.isIncome ? "income" : "received" })
    .eq("id", parsed.data.id)
    .eq("direction", "in")
    .is("category", null)
    .in("kind", ["income", "received"])
    .neq("source", "manual");
  refresh();
}

const changeSchema = z.object({
  counterparty: z.string().min(1).max(120),
  category: z.enum(EXPENSE_CATEGORIES),
});

export async function changeCategory(input: z.input<typeof changeSchema>) {
  const parsed = changeSchema.safeParse(input);
  if (!parsed.success) return;
  const { supabase } = await requireConsentedUser();
  await setMerchantCategory(supabase, parsed.data.counterparty, parsed.data.category);
  refresh();
}
