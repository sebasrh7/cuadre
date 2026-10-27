"use server";

import { refresh } from "next/cache";
import { requireUser } from "@/lib/auth";
import { foreignIncomeSchema } from "@/lib/schemas";

export type IncomeState = {
  errors?: Partial<Record<string, string>>;
  error?: string;
  saved?: number;
};

export async function addForeignIncome(state: IncomeState, formData: FormData): Promise<IncomeState> {
  const parsed = foreignIncomeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      errors[String(issue.path[0])] ??= issue.message;
    }
    return { errors };
  }

  const input = parsed.data;
  const { supabase } = await requireUser();

  // Si ya vio el abono en COP, se registra como movimiento manual; el extracto
  // lo reemplazará cuando se concilie (semana 2).
  let movementId: string | null = null;
  if (input.amountCop) {
    const { data, error } = await supabase
      .from("movements")
      .insert({
        occurred_on: input.receivedOn,
        amount_cop: input.amountCop,
        direction: "in",
        kind: "income",
        source: "manual",
        counterparty: input.payer ?? null,
        category: "Ingreso del exterior",
      })
      .select("id")
      .single();
    if (error) return { error: "No pudimos guardar el ingreso. Inténtalo de nuevo." };
    movementId = data.id;
  }

  const { error } = await supabase.from("foreign_incomes").insert({
    received_on: input.receivedOn,
    currency: "USD",
    amount_minor: input.amountUsdCents,
    payer: input.payer ?? null,
    movement_id: movementId,
  });

  if (error) {
    if (movementId) await supabase.from("movements").delete().eq("id", movementId);
    return { error: "No pudimos guardar el ingreso. Inténtalo de nuevo." };
  }

  refresh();
  return { saved: (state.saved ?? 0) + 1 };
}

export async function deleteForeignIncome(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const { supabase } = await requireUser();

  const { data } = await supabase.from("foreign_incomes").delete().eq("id", id).select("movement_id").single();
  // El movimiento manual se creó junto con el ingreso; los del extracto se conservan.
  if (data?.movement_id) {
    await supabase.from("movements").delete().eq("id", data.movement_id).eq("source", "manual");
  }
  refresh();
}
