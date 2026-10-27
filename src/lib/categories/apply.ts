import "server-only";
import type { requireUser } from "@/lib/auth";
import { isExpenseCategory, merchantKey, type ExpenseCategory } from "./categories";
import { categorizeMerchants, type ResolvedCategory } from "./categorize";
import { createGeminiProvider } from "./gemini";

type Supabase = Awaited<ReturnType<typeof requireUser>>["supabase"];

/** Llamadas a la IA por usuario y día. Con lotes de 40 comercios sobra. */
const DAILY_AI_LIMIT = 20;

export interface CategorizeSummary {
  categorized: number;
  pending: number;
  aiCalls: number;
  aiAvailable: boolean;
}

/** Categoriza los gastos sin categoría del usuario y guarda lo aprendido. */
export async function categorizePendingExpenses(supabase: Supabase): Promise<CategorizeSummary> {
  const provider = createGeminiProvider();
  const { data: movements } = await supabase
    .from("movements")
    .select("id, counterparty")
    .eq("kind", "expense")
    .is("category", null)
    .not("counterparty", "is", null);

  if (!movements?.length) return { categorized: 0, pending: 0, aiCalls: 0, aiAvailable: provider !== null };

  const withKey = movements.map((m) => ({ id: m.id, key: merchantKey(m.counterparty!) })).filter((m) => m.key);
  const keys = [...new Set(withKey.map((m) => m.key))];

  const { data: cached } = await supabase
    .from("merchant_categories")
    .select("merchant_key, category, source")
    .in("merchant_key", keys);
  const known = new Map<string, ResolvedCategory>();
  for (const row of cached ?? []) {
    if (isExpenseCategory(row.category)) {
      known.set(row.merchant_key, { category: row.category, source: row.source as ResolvedCategory["source"] });
    }
  }

  const result = await categorizeMerchants({
    merchantKeys: keys,
    known,
    provider,
    reserveAiCall: async () => {
      const { data } = await supabase.rpc("consume_ai_quota", { p_daily_limit: DAILY_AI_LIMIT });
      return data === true;
    },
  });

  if (result.learned.size) {
    await supabase.from("merchant_categories").upsert(
      [...result.learned].map(([merchant_key, { category, source }]) => ({ merchant_key, category, source })),
      { onConflict: "user_id,merchant_key" },
    );
  }

  let categorized = 0;
  for (const [category, ids] of groupIdsByCategory(withKey, result.resolved)) {
    const { error } = await supabase.from("movements").update({ category }).in("id", ids);
    if (!error) categorized += ids.length;
  }

  return {
    categorized,
    pending: withKey.length - categorized,
    aiCalls: result.aiCalls,
    aiAvailable: provider !== null,
  };
}

/**
 * Corrección del usuario: queda guardada para el comercio y se aplica a todos
 * sus gastos, pasados y futuros.
 */
export async function setMerchantCategory(supabase: Supabase, counterparty: string, category: ExpenseCategory) {
  const key = merchantKey(counterparty);
  await supabase
    .from("merchant_categories")
    .upsert({ merchant_key: key, category, source: "user", updated_at: new Date().toISOString() }, { onConflict: "user_id,merchant_key" });

  const { data } = await supabase.from("movements").select("id, counterparty").eq("kind", "expense");
  const ids = (data ?? []).filter((m) => m.counterparty && merchantKey(m.counterparty) === key).map((m) => m.id);
  if (ids.length) await supabase.from("movements").update({ category }).in("id", ids);
}

function groupIdsByCategory(
  movements: { id: string; key: string }[],
  resolved: Map<string, ResolvedCategory>,
): Map<ExpenseCategory, string[]> {
  const groups = new Map<ExpenseCategory, string[]>();
  for (const m of movements) {
    const category = resolved.get(m.key)?.category;
    if (!category) continue;
    groups.set(category, [...(groups.get(category) ?? []), m.id]);
  }
  return groups;
}
