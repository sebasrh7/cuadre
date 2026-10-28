import type { MetadataRoute } from "next";

/**
 * Permite instalar Cuadre en el celular y recibir alertas con "Compartir →
 * Cuadre" (Android). El service worker no guarda datos en caché.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cuadre",
    short_name: "Cuadre",
    description: "Tus finanzas de independiente en Colombia, cuadradas.",
    lang: "es-CO",
    start_url: "/inicio",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#047857",
    share_target: {
      action: "/alertas/compartir",
      method: "POST",
      enctype: "multipart/form-data",
      params: { title: "title", text: "text", url: "url" },
    },
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
