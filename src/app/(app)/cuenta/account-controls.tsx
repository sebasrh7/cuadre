"use client";

import { useActionState, useTransition } from "react";
import { FormError, Input } from "@/components/ui";
import { deleteAccount, setAiCategorization, type DeleteState } from "./actions";

export function AiToggle({ enabled }: { enabled: boolean }) {
  const [pending, start] = useTransition();
  return (
    <label className="flex items-start gap-2">
      <input
        type="checkbox"
        defaultChecked={enabled}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.checked;
          start(() => setAiCategorization(next));
        }}
        className="mt-1"
      />
      <span>
        Usar Gemini (Google) para sugerir la categoría de los gastos que las reglas no reconocen. Solo se envían
        nombres de comercio, sin montos, fechas ni nombres de personas.
        <span className="block text-muted">Apagado: los gastos desconocidos quedan para que los categorices tú.</span>
      </span>
    </label>
  );
}

export function DeleteAccountForm() {
  const [state, action, pending] = useActionState<DeleteState, FormData>(deleteAccount, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span>
          Escribe <strong>BORRAR</strong> para confirmar
        </span>
        <Input name="confirmation" autoComplete="off" required />
      </label>
      <FormError message={state.error} />
      <button
        disabled={pending}
        className="self-start rounded-md bg-danger px-4 py-2 font-medium text-white disabled:opacity-50 dark:text-black"
      >
        {pending ? "Borrando…" : "Borrar mi cuenta y todos mis datos"}
      </button>
    </form>
  );
}
