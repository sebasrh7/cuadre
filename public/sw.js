// Service worker de Cuadre. Hace UNA sola cosa: recibir lo que el usuario
// comparte desde otra app (Compartir → Cuadre) y pasárselo a /alertas sin que
// el texto viaje al servidor. No guarda páginas ni datos en caché.

const SHARE_PATH = "/alertas/compartir";
const SHARE_CACHE = "cuadre-compartido";
const SHARE_KEY = "/__texto-compartido";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "POST" || url.pathname !== SHARE_PATH) return;

  event.respondWith(
    (async () => {
      const form = await event.request.formData();
      const text = ["title", "text", "url"]
        .map((field) => form.get(field))
        .filter((value) => typeof value === "string" && value.trim())
        .join("\n");
      // Queda solo en este dispositivo, hasta que /alertas lo lea y lo borre.
      const cache = await caches.open(SHARE_CACHE);
      await cache.put(SHARE_KEY, new Response(text));
      return Response.redirect("/alertas?compartido=1", 303);
    })(),
  );
});
