"use client";

import { useEffect, useState } from "react";
import { clearInstallPrompt, subscribeInstallPrompt, type BeforeInstallPromptEvent } from "@/lib/install-prompt";

type Mode = "hidden" | "prompt" | "ios";

/**
 * Botón "Instalar Cuadre". En Chrome/Edge/Android usa el diálogo del sistema;
 * en iPhone (Safari no permite instalar con un botón) muestra los pasos. No se
 * muestra si la app ya está instalada.
 */
export function InstallApp() {
  const [mode, setMode] = useState<Mode>("hidden");
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showSteps, setShowSteps] = useState(false);

  useEffect(() => {
    const installed =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (installed) return;

    const unsubscribe = subscribeInstallPrompt((prompt) => {
      setEvent(prompt);
      setMode((current) => (prompt ? "prompt" : current === "ios" ? "ios" : "hidden"));
    });

    // iPhone/iPad: no hay evento de instalación.
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (ios) timer = setTimeout(() => setMode("ios"), 0);

    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (mode === "hidden") return null;

  if (mode === "ios") {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-border p-3 text-sm">
        <button onClick={() => setShowSteps((s) => !s)} className="self-start font-medium text-accent underline">
          Instalar Cuadre en tu iPhone
        </button>
        {showSteps && (
          <ol className="list-decimal pl-5 text-muted">
            <li>Abre esta página en Safari.</li>
            <li>Toca el botón Compartir (el cuadrado con la flecha hacia arriba).</li>
            <li>Elige «Agregar a inicio».</li>
          </ol>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={async () => {
        if (!event) return;
        await event.prompt();
        await event.userChoice;
        // Aceptado o no, el aviso solo se puede usar una vez: el botón se oculta.
        setMode("hidden");
        clearInstallPrompt();
        setEvent(null);
      }}
      className="flex items-center gap-2 self-start rounded-md border border-accent px-4 py-2 text-sm font-medium text-accent"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Instalar Cuadre
    </button>
  );
}
