"use client";

import "./globals.css";

/** Último recurso: reemplaza todo el layout si falla la raíz. */
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="es-CO">
      <body className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
        <h1 className="text-xl font-semibold">Cuadre tuvo un problema</h1>
        <p className="text-sm">Recarga la página. Si sigue pasando, vuelve a intentarlo en unos minutos.</p>
        <button onClick={() => retry()} className="rounded-md border px-4 py-2">
          Reintentar
        </button>
      </body>
    </html>
  );
}
