"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <section className="flex flex-col items-start gap-3">
      <h1 className="text-xl font-semibold">Algo salió mal</h1>
      <p className="text-sm text-muted">
        No es tu culpa. Inténtalo de nuevo; si sigue pasando, cuéntanos en Comentarios qué estabas haciendo.
      </p>
      <button onClick={() => retry()} className="rounded-md bg-accent px-4 py-2 font-medium text-white dark:text-black">
        Reintentar
      </button>
    </section>
  );
}
