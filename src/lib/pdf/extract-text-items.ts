import type { TextItem } from "@/lib/parsers/bancolombia-statement";

export type ExtractResult =
  | { ok: true; items: TextItem[] }
  | { ok: false; reason: "needs_password" | "wrong_password" | "unreadable" };

/**
 * Extrae el texto con posiciones de un PDF, en el navegador. El archivo y la
 * contraseña nunca salen del dispositivo: al servidor solo llegan los
 * movimientos ya leídos.
 */
export async function extractTextItems(file: ArrayBuffer, password?: string): Promise<ExtractResult> {
  // pdf.js usa APIs del navegador al cargarse: solo se importa en el cliente.
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const task = pdfjs.getDocument({ data: new Uint8Array(file), password });
  let pdf;
  try {
    pdf = await task.promise;
  } catch (error) {
    if (error instanceof Error && error.name === "PasswordException") {
      return { ok: false, reason: password ? "wrong_password" : "needs_password" };
    }
    return { ok: false, reason: "unreadable" };
  }

  const items: TextItem[] = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const content = await page.getTextContent();
    for (const item of content.items) {
      if (!("str" in item)) continue;
      items.push({ page: n, x: item.transform[4], y: item.transform[5], str: item.str });
    }
  }
  await task.destroy();
  return { ok: true, items };
}
