"use client";

import { useState, useTransition } from "react";
import { formatCop } from "@/lib/money/format";
import { declareMonthIncome } from "./actions";

/** Para un mes sin extracto: el usuario dice cuánto le llegó y la app calcula la PILA. */
export function DeclareIncomeForm({
  month,
  monthLabel,
  suggestion,
  current,
}: {
  month: string;
  monthLabel: string;
  suggestion: number | null;
  current?: number;
}) {
  const [value, setValue] = useState(current ? String(current) : "");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const amountCop = Number(value.replace(/\D/g, ""));

  return (
    <form
      className="flex flex-col gap-2 text-sm"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const result = await declareMonthIncome({ month, amountCop });
          setError(result.ok ? undefined : result.error);
        });
      }}
    >
      <label className="flex flex-col gap-1">
        <span>¿Cuánto te llegó en {monthLabel}? Suma todo lo que recibiste por tu trabajo.</span>
        <span className="flex gap-2">
          <input
            inputMode="numeric"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={suggestion ? String(suggestion) : "Monto en pesos"}
            className="w-40 rounded border border-border bg-background px-2 py-1 tabular-nums"
          />
          <button
            disabled={pending || amountCop <= 0}
            className="rounded-md bg-accent px-3 py-1 font-medium text-white disabled:opacity-50 dark:text-black"
          >
            {pending ? "Guardando…" : "Calcular"}
          </button>
        </span>
      </label>
      <p className="text-xs text-muted">
        {suggestion ? `Tu promedio de los meses con extracto es ${formatCop(suggestion)}. ` : ""}
        Si no recibiste nada, no tienes que pagar. Cuando importes el extracto, esta cifra se reemplaza por la real.
      </p>
      {error && <p className="text-xs text-danger">{error}</p>}
    </form>
  );
}
