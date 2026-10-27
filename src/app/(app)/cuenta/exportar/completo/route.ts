import { requireUser } from "@/lib/auth";

/** Todos los datos del usuario en JSON (portabilidad, Ley 1581). */
export async function GET() {
  const { supabase, userId } = await requireUser();
  const [profile, accounts, aliases, movements, foreignIncomes, categories] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).single(),
    supabase.from("own_accounts").select("institution, kind, last4, label, created_at"),
    supabase.from("own_aliases").select("kind, value, created_at"),
    supabase.from("movements").select("occurred_on, occurred_at_time, amount_cop, direction, kind, counterparty, account_last4, category, source, created_at").order("occurred_on"),
    supabase.from("foreign_incomes").select("received_on, currency, amount_minor, payer, created_at"),
    supabase.from("merchant_categories").select("merchant_key, category, source, updated_at"),
  ]);

  const body = JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      note: "Montos en COP como enteros (pesos); amount_minor en centavos de la moneda indicada.",
      profile: profile.data,
      ownAccounts: accounts.data,
      ownAliases: aliases.data,
      movements: movements.data,
      foreignIncomes: foreignIncomes.data,
      merchantCategories: categories.data,
    },
    null,
    2,
  );
  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="cuadre-datos.json"`,
      "Cache-Control": "no-store",
    },
  });
}
