"use client";

import { useActionState } from "react";
import { Button, Field, FormError, Input } from "@/components/ui";
import { addForeignIncome, type IncomeState } from "./actions";

export function IncomeForm({ today }: { today: string }) {
  const [state, action, pending] = useActionState<IncomeState, FormData>(addForeignIncome, {});
  const e = state.errors ?? {};

  return (
    // La key reinicia el formulario después de cada ingreso guardado.
    <form key={state.saved ?? 0} action={action} className="flex flex-col gap-4 rounded-lg border border-border p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Fecha en que llegó" error={e.receivedOn}>
          <Input name="receivedOn" type="date" defaultValue={today} max={today} required />
        </Field>
        <Field label="Monto en USD" hint="Lo que te pagaron, antes de comisiones." error={e.amountUsdCents}>
          <Input name="amountUsdCents" inputMode="decimal" placeholder="1.500,00" required />
        </Field>
        <Field
          label="Abono en COP (opcional)"
          hint="Lo que llegó a tu cuenta como ABONO DE GIRO INTERNACIONAL."
          error={e.amountCop}
        >
          <Input name="amountCop" inputMode="decimal" placeholder="5.850.000" />
        </Field>
        <Field label="Quién te pagó (opcional)" error={e.payer}>
          <Input name="payer" maxLength={120} />
        </Field>
      </div>
      <FormError message={state.error} />
      <Button disabled={pending}>{pending ? "Guardando…" : "Agregar ingreso"}</Button>
    </form>
  );
}
