/**
 * Chrome/Edge/Android avisan UNA vez por carga de página que la app se puede
 * instalar (`beforeinstallprompt`). Se captura aquí, desde la raíz, para que el
 * botón de instalar funcione aunque se monte después, en otra pantalla.
 */
export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let pending: BeforeInstallPromptEvent | null = null;
const listeners = new Set<(event: BeforeInstallPromptEvent | null) => void>();

export function captureInstallPrompt() {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    pending = e as BeforeInstallPromptEvent;
    listeners.forEach((l) => l(pending));
  });
  window.addEventListener("appinstalled", () => {
    pending = null;
    listeners.forEach((l) => l(null));
  });
}

export function subscribeInstallPrompt(listener: (event: BeforeInstallPromptEvent | null) => void) {
  listeners.add(listener);
  listener(pending);
  return () => listeners.delete(listener);
}

export function clearInstallPrompt() {
  pending = null;
}
