/** Lee y borra el texto que dejó el service worker al compartir hacia Cuadre. */
export async function takeSharedText(): Promise<string | null> {
  if (typeof caches === "undefined") return null;
  const cache = await caches.open("cuadre-compartido");
  const response = await cache.match("/__texto-compartido");
  if (!response) return null;
  await cache.delete("/__texto-compartido");
  return response.text();
}
