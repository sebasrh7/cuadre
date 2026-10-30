// Genera un PDF del extracto SINTÉTICO (mismos textos y posiciones del
// fixture), para probar la importación de punta a punta sin datos reales.
import { PDFDocument, StandardFonts } from "pdf-lib";
import type { TextItem } from "../statement";
import { buildStatement } from "./bancolombia-statement";

/** Por defecto, el extracto sintético de Bancolombia; también sirve para los de Nequi y Nu. */
export async function buildStatementPdf(items: TextItem[] = buildStatement()): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  // Helvetica no trae todos los caracteres (p. ej. el ↪ de la tarjeta Nu): los que falten se omiten.
  const supported = new Set(font.getCharacterSet());
  const encodable = (str: string) => [...str].filter((ch) => supported.has(ch.codePointAt(0)!)).join("").trim();
  const pageCount = Math.max(...items.map((i) => i.page));

  for (let n = 1; n <= pageCount; n++) {
    const onPage = items.filter((i) => i.page === n);
    // Los extractos de Nu son más altos que una carta.
    const page = doc.addPage([612, Math.max(792, ...onPage.map((i) => i.y + 20))]);
    for (const item of onPage) {
      page.drawText(encodable(item.str), { x: item.x, y: item.y, size: 7, font });
    }
  }
  return doc.save();
}
