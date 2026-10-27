"use client";

import { useActionState } from "react";
import { Button, Field, FormError, Input } from "@/components/ui";
import { login, type LoginState } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, { step: "email" });

  if (state.step === "sent") {
    return (
      <p className="text-sm text-muted">
        Te enviamos un enlace a <strong className="text-foreground">{state.email}</strong>. Ábrelo en
        este mismo navegador para entrar. Revisa también la carpeta de spam.
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Correo">
        <Input name="email" type="email" autoComplete="email" required autoFocus />
      </Field>
      <FormError message={state.error} />
      <Button disabled={pending}>{pending ? "Enviando…" : "Enviarme un enlace para entrar"}</Button>
    </form>
  );
}
