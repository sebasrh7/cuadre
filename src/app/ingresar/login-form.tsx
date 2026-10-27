"use client";

import { useActionState } from "react";
import { Button, Field, FormError, Input } from "@/components/ui";
import { login, type LoginState } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, { step: "email" });

  if (state.step === "email") {
    return (
      <form action={action} className="flex flex-col gap-4">
        <Field label="Correo">
          <Input name="email" type="email" autoComplete="email" required autoFocus />
        </Field>
        <FormError message={state.error} />
        <Button disabled={pending}>{pending ? "Enviando…" : "Enviarme un código"}</Button>
      </form>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        Te enviamos un código de 6 dígitos a <strong className="text-foreground">{state.email}</strong>.
        Revisa también la carpeta de spam.
      </p>
      <Field label="Código">
        <Input
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          required
          autoFocus
        />
      </Field>
      <FormError message={state.error} />
      <Button disabled={pending}>{pending ? "Verificando…" : "Entrar"}</Button>
      <Button variant="ghost" name="intent" value="change-email" formNoValidate disabled={pending}>
        Usar otro correo
      </Button>
    </form>
  );
}
