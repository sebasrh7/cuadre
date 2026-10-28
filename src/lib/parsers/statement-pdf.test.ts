import { describe, expect, it } from "vitest";
import { buildStatementPdf } from "./__fixtures__/statement-pdf";
import { parseBancolombiaStatement, type TextItem } from "./bancolombia-statement";

/** Lectura con pdf.js en Node (la app usa la versión de navegador; el resultado es el mismo). */
async function extract(data: Uint8Array): Promise<TextItem[]> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const pdf = await getDocument({ data }).promise;
  const items: TextItem[] = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const content = await (await pdf.getPage(n)).getTextContent();
    for (const item of content.items) {
      if ("str" in item) items.push({ page: n, x: item.transform[4], y: item.transform[5], str: item.str });
    }
  }
  return items;
}

describe("PDF sintético del extracto", () => {
  it("se lee con pdf.js y el lector lo entiende igual que al fixture", async () => {
    const result = parseBancolombiaStatement(await extract(await buildStatementPdf()));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.statement.movements).toHaveLength(8);
    expect(result.statement.accountLast4).toBe("8901");
    expect(result.statement.movements[1].description).toBe("ABONO DE GIRO INTERNACIONAL");
  });
});
