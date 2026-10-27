"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { categorizePendingExpenses, setMerchantCategory, type CategorizeSummary } from "@/lib/categories/apply";
import { EXPENSE_CATEGORIES } from "@/lib/categories/categories";

export async function categorizePending(): Promise<CategorizeSummary> {
  const { supabase } = await requireUser();
  const summary = await categorizePendingExpenses(supabase);
  refresh();
  return summary;
}

const changeSchema = z.object({
  counterparty: z.string().min(1).max(120),
  category: z.enum(EXPENSE_CATEGORIES),
});

export async function changeCategory(input: z.input<typeof changeSchema>) {
  const parsed = changeSchema.safeParse(input);
  if (!parsed.success) return;
  const { supabase } = await requireUser();
  await setMerchantCategory(supabase, parsed.data.counterparty, parsed.data.category);
  refresh();
}
