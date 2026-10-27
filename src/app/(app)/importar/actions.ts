"use server";

import { createHash } from "node:crypto";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { categorizePendingExpenses } from "@/lib/categories/apply";
import {
  FOREIGN_INCOME_CATEGORY,
  planStatementImport,
  reconcileForeignIncomes,
} from "@/lib/movements/statement-import";
import { verifyStatement } from "@/lib/parsers/bancolombia-statement";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const cents = z.number().int().safe();

const importSchema = z.object({
  statement: z.object({
    from: isoDate,
    to: isoDate,
    accountLast4: z.string().regex(/^\d{4}$/),
    previousBalanceCents: cents,
    currentBalanceCents: cents,
    totalCreditsCents: cents,
    totalDebitsCents: cents,
    movements: z
      .array(
        z.object({
          date: isoDate,
          description: z.string().max(200),
          amountCents: cents,
          balanceCents: cents,
        }),
      )
      .max(2000),
  }),
  decisions: z.object({
    nequiIsOwn: z.boolean(),
    ownPersonNames: z.array(z.string().max(120)).max(50),
  }),
});

export type ImportInput = z.input<typeof importSchema>;

export type ImportResult =
  | { ok: true; inserted: number; duplicates: number; linkedIncomes: number; categorized: number; uncategorized: number }
  | { ok: false; error: string };

export async function importStatement(input: ImportInput): Promise<ImportResult> {
  const parsed = importSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Los datos del extracto no son válidos." };
  const { statement, decisions } = parsed.data;

  // No se confía en el navegador: el extracto debe volver a cuadrar aquí.
  if (verifyStatement(statement)) return { ok: false, error: "El extracto no cuadra. No se guardó nada." };

  const { supabase, userId } = await requireUser();
  const planned = planStatementImport(statement, decisions);

  const rows = planned.map((m) => ({
    user_id: userId,
    occurred_on: m.occurredOn,
    amount_cop: m.amountCop,
    direction: m.direction,
    kind: m.kind,
    counterparty: m.counterparty,
    category: m.category,
    account_last4: m.accountLast4,
    source: "statement",
    // Solo se guarda el hash: la clave incluye la descripción original.
    dedupe_hash: createHash("sha256").update(m.dedupeKey).digest("hex"),
  }));

  const { data: inserted, error } = await supabase
    .from("movements")
    .upsert(rows, { onConflict: "user_id,dedupe_hash", ignoreDuplicates: true })
    .select("id");
  if (error) return { ok: false, error: "No pudimos guardar los movimientos. Inténtalo de nuevo." };

  // La cuenta del extracto queda registrada como propia.
  await supabase
    .from("own_accounts")
    .upsert(
      { user_id: userId, institution: "bancolombia", kind: "savings", last4: statement.accountLast4 },
      { onConflict: "user_id,institution,kind,last4", ignoreDuplicates: true },
    );

  const linkedIncomes = await linkForeignIncomes(supabase, statement.from, statement.to);
  // Si la categorización falla, los movimientos ya quedaron guardados: se reintenta desde /movimientos.
  const categories = await categorizePendingExpenses(supabase).catch(() => null);

  return {
    ok: true,
    inserted: inserted?.length ?? 0,
    duplicates: rows.length - (inserted?.length ?? 0),
    linkedIncomes,
    categorized: categories?.categorized ?? 0,
    uncategorized: categories?.pending ?? 0,
  };
}

type Supabase = Awaited<ReturnType<typeof requireUser>>["supabase"];

/** Enlaza los ingresos en USD del periodo con los giros del extracto. */
async function linkForeignIncomes(supabase: Supabase, from: string, to: string): Promise<number> {
  const [giros, incomes] = await Promise.all([
    supabase
      .from("movements")
      .select("id, occurred_on, amount_cop")
      .eq("source", "statement")
      .eq("category", FOREIGN_INCOME_CATEGORY)
      .gte("occurred_on", from)
      .lte("occurred_on", to),
    supabase
      .from("foreign_incomes")
      .select("id, received_on, movement_id, movements(id, amount_cop, source)")
      .gte("received_on", shiftDays(from, -5))
      .lte("received_on", shiftDays(to, 5)),
  ]);
  if (giros.error || incomes.error) return 0;

  const linkedGiros = new Set(incomes.data.map((i) => i.movement_id).filter(Boolean));
  const pending = incomes.data
    // Los que ya apuntan a un movimiento del extracto quedan como están.
    .filter((i) => i.movements?.source !== "statement")
    .map((i) => ({
      id: i.id,
      receivedOn: i.received_on,
      manualMovement: i.movements ? { id: i.movements.id, amountCop: i.movements.amount_cop } : null,
    }));

  const links = reconcileForeignIncomes(
    giros.data
      .filter((g) => !linkedGiros.has(g.id))
      .map((g) => ({ movementId: g.id, occurredOn: g.occurred_on, amountCop: g.amount_cop })),
    pending,
  );

  let linked = 0;
  for (const link of links) {
    const { error } = await supabase
      .from("foreign_incomes")
      .update({ movement_id: link.movementId })
      .eq("id", link.incomeId);
    if (error) continue;
    linked++;
    if (link.replacesManualMovementId) {
      await supabase
        .from("movements")
        .delete()
        .eq("id", link.replacesManualMovementId)
        .eq("source", "manual");
    }
  }
  return linked;
}

function shiftDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
