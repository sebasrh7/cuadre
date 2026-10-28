"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, Field, FormError, Input, Select, Textarea } from "@/components/ui";
import { saveOnboarding, type OnboardingState } from "./actions";

export type OnboardingDefaults = {
  workerType: string;
  arlRisk: string;
  idLastTwo: string;
  ownNames: string;
  ownKeys: string;
  savingsLast4: string;
  debitCardLast4: string;
  creditCardLast4: string;
  privacyAccepted: boolean;
  aiCategorization: boolean;
};

export function OnboardingForm({ defaults }: { defaults: OnboardingDefaults }) {
  const [state, action, pending] = useActionState<OnboardingState, FormData>(saveOnboarding, {});
  const e = state.errors ?? {};

  return (
    <form action={action} className="flex flex-col gap-6">
      <fieldset className="min-w-0 flex flex-col gap-4">
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
          label="Dos últimos dígitos de tu cédula"
          hint="Definen la fecha límite de tu PILA y de tu declaración de renta. No pedimos el número completo."
          error={e.idLastTwo}
        >
          <Input
            name="idLastTwo"
            inputMode="numeric"
            pattern="\d{2}"
            maxLength={2}
            placeholder="07"
            defaultValue={defaults.idLastTwo}
            required
          />
        </Field>
      </fieldset>

      <fieldset className="min-w-0 flex flex-col gap-4">
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

      <fieldset className="min-w-0 flex flex-col gap-3 text-sm">
        <legend className="mb-2 font-semibold">Tus datos</legend>
        <label className="flex items-start gap-2">
          <input type="checkbox" name="privacyAccepted" defaultChecked={defaults.privacyAccepted} required className="mt-1" />
          <span>
            Autorizo a Cuadre a tratar mis datos según la{" "}
            <Link href="/privacidad" target="_blank" className="text-accent underline">
              política de tratamiento de datos
            </Link>
            .
          </span>
        </label>
        {e.privacyAccepted && <span className="text-danger">{e.privacyAccepted}</span>}
        <label className="flex items-start gap-2">
          <input type="checkbox" name="aiCategorization" defaultChecked={defaults.aiCategorization} className="mt-1" />
          <span>
            Opcional: usar IA (Gemini, de Google) para sugerir la categoría de mis gastos. Solo se envían nombres de
            comercio, sin montos, fechas ni nombres de personas. Puedes cambiarlo cuando quieras.
          </span>
        </label>
      </fieldset>

      <FormError message={state.error} />
      <Button disabled={pending}>{pending ? "Guardando…" : "Guardar"}</Button>
    </form>
  );
}
