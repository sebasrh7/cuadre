"use client";

import { useEffect } from "react";
import { captureInstallPrompt } from "@/lib/install-prompt";

/**
 * Registra el service worker que recibe lo compartido desde otras apps y
 * guarda el aviso de instalación para el botón "Instalar Cuadre".
 */
export function ServiceWorker() {
  useEffect(() => {
    captureInstallPrompt();
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // Sin service worker la app funciona igual; solo no recibe lo compartido.
      });
    }
  }, []);
  return null;
}
