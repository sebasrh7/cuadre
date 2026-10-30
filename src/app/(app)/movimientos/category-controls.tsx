"use client";

import { useState, useTransition } from "react";
import { EXPENSE_CATEGORIES, UNCATEGORIZED, type ExpenseCategory } from "@/lib/categories/categories";
import type { CategorizeSummary } from "@/lib/categories/apply";
import { categorizePending, changeCategory, markAsIncome } from "./actions";

/** Cambia la categoría de un comercio: aplica a todos sus gastos. */
export function CategorySelect({ counterparty, category }: { counterparty: string; category: string | null }) {
  const [pending, start] = useTransition();
  return (
    <select
      aria-label={`Categoría de ${counterparty}`}
      defaultValue={category ?? ""}
      disabled={pending}
      onChange={(e) =>
        start(() => changeCategory({ counterparty, category: e.target.value as ExpenseCategory }))
      }
      className={`rounded border border-border bg-background px-1 py-0.5 text-xs ${category ? "text-muted" : "text-danger"}`}
    >
      {!category && <option value="">{UNCATEGORIZED}</option>}
      {EXPENSE_CATEGORIES.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </select>
  );
}

/** Lo recibido de personas no cuenta como ingreso hasta que el usuario lo diga. */
export function IncomeToggle({ id, isIncome }: { id: string; isIncome: boolean }) {
  const [pending, start] = useTransition();
  return (
    <label className={`flex items-center gap-1 ${isIncome ? "text-accent" : "text-muted"}`}>
      <input
        type="checkbox"
        checked={isIncome}
        disabled={pending}
        onChange={(e) => start(() => markAsIncome({ id, isIncome: e.target.checked }))}
      />
      Es ingreso
    </label>
  );
}

export function CategorizeButton({ uncategorized }: { uncategorized: number }) {
  const [pending, start] = useTransition();
  const [summary, setSummary] = useState<CategorizeSummary>();

  if (uncategorized === 0 && !summary) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3 text-sm">
      {uncategorized > 0 && (
        <button
          onClick={() => start(async () => setSummary(await categorizePending()))}
          disabled={pending}
          className="rounded-md bg-accent px-3 py-1.5 font-medium text-white disabled:opacity-50 dark:text-black"
        >
          {pending ? "Categorizando…" : `Categorizar ${uncategorized} gastos`}
        </button>
      )}
      {summary && (
        <p className="text-muted">
          {summary.categorized} categorizados
          {summary.personal > 0 && ` · ${summary.personal} parecen pagos a personas: asígnales categoría tú (no se envían a la IA)`}
          {summary.pending - summary.personal > 0 &&
            ` · ${summary.pending - summary.personal} pendientes${summary.aiAvailable ? " (sin cupo de IA hoy o la IA no respondió)" : " (la IA está apagada: actívala en Mi cuenta o asígnalas tú)"}`}
          . Puedes corregir cualquiera: el cambio aplica a todos los gastos de ese comercio.
        </p>
      )}
    </div>
  );
}
