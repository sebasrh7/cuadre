"use client";

import { useActionState } from "react";
import { Button, Field, FormError, Input, Select, Textarea } from "@/components/ui";
import { saveOnboarding, type OnboardingState } from "./actions";

export type OnboardingDefaults = {
  workerType: string;
  arlRisk: string;
  nitLastDigit: string;
  ownNames: string;
  ownKeys: string;
  savingsLast4: string;
  debitCardLast4: string;
  creditCardLast4: string;
};

export function OnboardingForm({ defaults }: { defaults: OnboardingDefaults }) {
  const [state, action, pending] = useActionState<OnboardingState, FormData>(saveOnboarding, {});
  const e = state.errors ?? {};

  return (
    <form action={action} className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 font-semibold">Tu situación</legend>
        <Field label="¿Cómo trabajas?" error={e.workerType}>
          <Select name="workerType" defaultValue={defaults.workerType} required>
            <option value="freelancer">Independiente con clientes (freelance)</option>
            <option value="employee_contractor">Contratista con horario para un solo cliente</option>
            <option value="other">Otro</option>
          </Select>
        </Field>
        <Field label="Nivel de riesgo ARL" hint="Trabajo de oficina o remoto es nivel 1." error={e.arlRisk}>
          <Select name="arlRisk" defaultValue={defaults.arlRisk} required>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Último dígito de tu cédula o NIT"
          hint="Define tus fechas de la DIAN. No pedimos el número completo."
          error={e.nitLastDigit}
        >
          <Input
            name="nitLastDigit"
            inputMode="numeric"
            pattern="\d"
            maxLength={1}
            defaultValue={defaults.nitLastDigit}
            required
          />
        </Field>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 font-semibold">Lo que es tuyo</legend>
        <p className="text-sm text-muted">
          Con esto reconocemos cuándo mueves plata entre tus propias cuentas, para no contarlo como
          ingreso ni como gasto.
        </p>
        <Field
          label="Tu nombre como aparece en las transferencias"
          hint="Si aparece de varias formas, sepáralas con comas."
          error={e.ownNames}
        >
          <Textarea name="ownNames" defaultValue={defaults.ownNames} required />
        </Field>
        <Field label="Tus llaves (Bre-B, celular)" hint="Separadas por comas. Opcional." error={e.ownKeys}>
          <Textarea name="ownKeys" defaultValue={defaults.ownKeys} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Cuenta de ahorros Bancolombia" hint="Últimos 4 dígitos" error={e.savingsLast4}>
            <Input name="savingsLast4" inputMode="numeric" maxLength={4} defaultValue={defaults.savingsLast4} />
          </Field>
          <Field label="Tarjeta débito" hint="Últimos 4 dígitos" error={e.debitCardLast4}>
            <Input name="debitCardLast4" inputMode="numeric" maxLength={4} defaultValue={defaults.debitCardLast4} />
          </Field>
          <Field label="Tarjeta de crédito" hint="Últimos 4 dígitos" error={e.creditCardLast4}>
            <Input name="creditCardLast4" inputMode="numeric" maxLength={4} defaultValue={defaults.creditCardLast4} />
          </Field>
        </div>
      </fieldset>

      <FormError message={state.error} />
      <Button disabled={pending}>{pending ? "Guardando…" : "Guardar"}</Button>
    </form>
  );
}
