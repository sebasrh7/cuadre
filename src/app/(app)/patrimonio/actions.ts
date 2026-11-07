"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireConsentedUser } from "@/lib/auth";
import { ASSET_KINDS, type AssetKind } from "@/lib/tax/patrimonio";

const pesos = z.number().int().min(0).max(100_000_000_000);

export type PatrimonioResult = { ok: true } | { ok: false; error: string };

const balanceSchema = z.object({ accountId: z.uuid(), balanceCop: pesos });

/** Saldo escrito por el usuario: para cuentas sin extracto o con uno viejo. */
export async function setAccountBalance(input: z.input<typeof balanceSchema>): Promise<PatrimonioResult> {
  const parsed = balanceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Escribe un saldo válido en pesos." };
  const { supabase } = await requireConsentedUser();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
  const { error } = await supabase
    .from("own_accounts")
    .update({ balance_cop: parsed.data.balanceCop, balance_on: today })
    .eq("id", parsed.data.accountId)
    .neq("kind", "credit_card");
  if (error) return { ok: false, error: "No pudimos guardar el saldo. Inténtalo de nuevo." };
  refresh();
  return { ok: true };
}

const assetSchema = z.object({
  kind: z.enum(Object.keys(ASSET_KINDS) as [AssetKind, ...AssetKind[]]),
  label: z.string().trim().max(40).optional(),
  valueCop: pesos.min(1),
});

export async function addAsset(input: z.input<typeof assetSchema>): Promise<PatrimonioResult> {
  const parsed = assetSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revisa el tipo y el valor del bien." };
  const { supabase } = await requireConsentedUser();
  const { error } = await supabase.from("assets").insert({
    kind: parsed.data.kind,
    label: parsed.data.label || null,
    value_cop: parsed.data.valueCop,
  });
  if (error) return { ok: false, error: "No pudimos guardar el bien. Inténtalo de nuevo." };
  refresh();
  return { ok: true };
}

export async function deleteAsset(formData: FormData) {
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  const { supabase } = await requireConsentedUser();
  await supabase.from("assets").delete().eq("id", id.data);
  refresh();
}
