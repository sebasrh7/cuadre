"use client";

import { useEffect } from "react";

/** Registra el service worker que recibe lo compartido desde otras apps. */
export function ServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // Sin service worker la app funciona igual; solo no recibe lo compartido.
      });
    }
  }, []);
  return null;
}
