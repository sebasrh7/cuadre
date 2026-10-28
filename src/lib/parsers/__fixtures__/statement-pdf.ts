// Genera un PDF del extracto SINTÉTICO (mismos textos y posiciones del
// fixture), para probar la importación de punta a punta sin datos reales.
import { PDFDocument, StandardFonts } from "pdf-lib";
import { buildStatement } from "./bancolombia-statement";

export async function buildStatementPdf(): Promise<Uint8Array> {
  const items = buildStatement();
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pageCount = Math.max(...items.map((i) => i.page));

  for (let n = 1; n <= pageCount; n++) {
    const page = doc.addPage([612, 792]);
    for (const item of items.filter((i) => i.page === n)) {
      page.drawText(item.str, { x: item.x, y: item.y, size: 7, font });
    }
  }
  return doc.save();
}
