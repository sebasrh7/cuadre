"use client";

import { usePathname } from "next/navigation";
import { useActionState, useState } from "react";
import { sendFeedback, type FeedbackState } from "@/app/feedback-actions";
import { FormError } from "./ui";

/** Botón flotante para dejar comentarios, errores o ideas. */
export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [state, action, pending] = useActionState<FeedbackState, FormData>(sendFeedback, {});

  return (
    <div className="fixed right-4 bottom-4 z-10 flex flex-col items-end gap-2">
      {open && (
        <div className="w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-background p-4 shadow-lg">
          {state.sent ? (
            <p className="text-sm">¡Gracias! Lo leemos todo.</p>
          ) : (
            <form action={action} className="flex flex-col gap-2 text-sm">
              <label htmlFor="feedback-message" className="font-medium">
                ¿Algo no funciona o se te ocurre una mejora?
              </label>
              <textarea
                id="feedback-message"
                name="message"
                rows={4}
                maxLength={2000}
                required
                autoFocus
                className="rounded-md border border-border bg-background px-2 py-1"
              />
              <input type="hidden" name="page" value={pathname} />
              <p className="text-xs text-muted">No incluyas datos de tus cuentas ni contraseñas.</p>
              <FormError message={state.error} />
              <button
                disabled={pending}
                className="self-end rounded-md bg-accent px-3 py-1.5 font-medium text-white disabled:opacity-50 dark:text-black"
              >
                {pending ? "Enviando…" : "Enviar"}
              </button>
            </form>
          )}
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="rounded-full border border-border bg-background px-4 py-2 text-sm shadow-md"
      >
        {open ? "Cerrar" : "Comentarios"}
      </button>
    </div>
  );
}
