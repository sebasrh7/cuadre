"use client";

import { useState, useTransition } from "react";
import { Button, Field, FormError, Input, Select } from "@/components/ui";
import { ASSET_KINDS, type AssetKind } from "@/lib/tax/patrimonio";
import { addAsset, setAccountBalance } from "./actions";

const toPesos = (value: string) => Number(value.replace(/\D/g, ""));

/** Cambia el saldo de una cuenta a mano (queda con la fecha de hoy). */
export function BalanceForm({ accountId, current }: { accountId: string; current: number | null }) {
  const [value, setValue] = useState(current === null ? "" : String(current));
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const result = await setAccountBalance({ accountId, balanceCop: toPesos(value) });
          setError(result.ok ? undefined : result.error);
        });
      }}
    >
      <input
        aria-label="Saldo de hoy"
        inputMode="numeric"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Saldo de hoy"
        className="w-36 rounded border border-border bg-background px-2 py-1 text-sm tabular-nums"
      />
      <button disabled={pending || value === ""} className="text-sm text-accent underline disabled:opacity-50">
        {pending ? "Guardando…" : "Guardar"}
      </button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </form>
  );
}

export function AssetForm() {
  const [kind, setKind] = useState<AssetKind>("real_estate");
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-col gap-3 rounded-lg border border-border p-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const result = await addAsset({ kind, label, valueCop: toPesos(value) });
          setError(result.ok ? undefined : result.error);
          if (result.ok) {
            setLabel("");
            setValue("");
          }
        });
      }}
    >
      <Field label="Tipo de bien">
        <Select value={kind} onChange={(e) => setKind(e.target.value as AssetKind)}>
          {Object.entries(ASSET_KINDS).map(([key, text]) => (
            <option key={key} value={key}>
              {text}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Nombre (opcional)" hint="Para reconocerlo, por ejemplo «Moto».">
        <Input value={label} maxLength={40} onChange={(e) => setLabel(e.target.value)} />
      </Field>
      <Field label="Valor aproximado en pesos" hint="Inmuebles: el mayor entre el avalúo catastral y lo que pagaste. Vehículos e inversiones: lo que pagaste o su valor actual.">
        <Input inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} />
      </Field>
      <FormError message={error} />
      <Button disabled={pending || toPesos(value) <= 0}>{pending ? "Guardando…" : "Agregar bien"}</Button>
    </form>
  );
}
