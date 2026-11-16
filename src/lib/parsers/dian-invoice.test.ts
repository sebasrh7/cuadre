import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { buildDianAttachedDocumentXml, buildDianInvoiceXml, fixtureCufe } from "./__fixtures__/dian-invoice";
import { parseDianInvoice } from "./dian-invoice";
import { readInvoiceXmls } from "./dian-invoice-file";

const expected = {
  cufe: fixtureCufe("ab12"),
  number: "FE1234",
  issuedOn: "2026-12-05",
  issuerNit: "900123456",
  issuerName: "TIENDA EJEMPLO S.A.S.",
  totalCop: 45_900,
};

describe("parseDianInvoice", () => {
  it("lee la factura dentro del contenedor que llega por correo (AttachedDocument)", () => {
    expect(parseDianInvoice(buildDianAttachedDocumentXml())).toEqual({ ok: true, invoice: expected });
  });

  it("lee la factura sola (Invoice)", () => {
    expect(parseDianInvoice(buildDianInvoiceXml())).toEqual({ ok: true, invoice: expected });
  });

  it("toma el vendedor de la factura, no el remitente del contenedor ni el comprador", () => {
    const result = parseDianInvoice(buildDianAttachedDocumentXml());
    expect(result.ok && result.invoice.issuerNit).toBe("900123456");
    expect(JSON.stringify(result)).not.toContain("TITULAR DE PRUEBA");
    expect(JSON.stringify(result)).not.toContain("1000000010");
  });

  it("no depende de los prefijos de los espacios de nombres", () => {
    const xml = buildDianInvoiceXml().replaceAll("cbc:", "b:").replaceAll("cac:", "a:").replaceAll("xmlns:cbc", "xmlns:b").replaceAll("xmlns:cac", "xmlns:a");
    expect(parseDianInvoice(xml)).toEqual({ ok: true, invoice: expected });
  });

  it("acepta el contenedor con la factura escapada en vez de CDATA", () => {
    const escaped = buildDianInvoiceXml().replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
    const xml = buildDianAttachedDocumentXml().replace(/<!\[CDATA\[<\?xml version="1.0" encoding="UTF-8"[\s\S]*?\]\]>/, escaped);
    expect(parseDianInvoice(xml)).toEqual({ ok: true, invoice: expected });
  });

  it("redondea los centavos a pesos sin pasar por decimales", () => {
    const total = (raw: string) => {
      const result = parseDianInvoice(buildDianInvoiceXml({ total: raw }));
      return result.ok ? result.invoice.totalCop : result.problem;
    };
    expect(total("45900")).toBe(45_900);
    expect(total("45900.4")).toBe(45_900);
    expect(total("45900.50")).toBe(45_901);
    expect(total("45900.499999")).toBe(45_900);
    expect(total("1234567890.00")).toBe(1_234_567_890);
  });

  it("decodifica el nombre del vendedor y el CUFE en mayúsculas", () => {
    const result = parseDianInvoice(
      buildDianInvoiceXml({ issuerName: "PAN & CAFE LTDA", cufe: fixtureCufe("AB12") }),
    );
    expect(result).toMatchObject({ ok: true, invoice: { issuerName: "PAN & CAFE LTDA", cufe: fixtureCufe("ab12") } });
  });

  it("deja solo los dígitos del NIT", () => {
    const result = parseDianInvoice(buildDianInvoiceXml({ issuerNit: "900.123.456" }));
    expect(result.ok && result.invoice.issuerNit).toBe("900123456");
  });

  it("no guarda notas crédito: corrigen una factura, no son un gasto", () => {
    expect(parseDianInvoice(buildDianInvoiceXml({ root: "CreditNote" }))).toEqual({ ok: false, problem: "adjustment_note" });
    expect(parseDianInvoice(buildDianAttachedDocumentXml({ root: "CreditNote" }))).toEqual({
      ok: false,
      problem: "adjustment_note",
    });
  });

  it("rechaza facturas en otra moneda", () => {
    expect(parseDianInvoice(buildDianInvoiceXml({ currency: "USD" }))).toEqual({ ok: false, problem: "foreign_currency" });
  });

  it("rechaza facturas sin total, sin CUFE o con valores que no son montos", () => {
    for (const fixture of [{ total: "0.00" }, { total: "-100.00" }, { total: "1e5" }, { cufe: "no-es-un-cufe" }, { issuedOn: "05/12/2026" }, { issuerNit: "" }]) {
      expect(parseDianInvoice(buildDianInvoiceXml(fixture))).toEqual({ ok: false, problem: "missing_fields" });
    }
  });

  it("rechaza lo que no es una factura electrónica", () => {
    for (const xml of ["", "hola", "<html><body>Factura</body></html>", "<Invoice>", "%PDF-1.7"]) {
      expect(parseDianInvoice(xml).ok).toBe(false);
    }
    expect(parseDianInvoice("<ApplicationResponse><ID>1</ID></ApplicationResponse>")).toEqual({
      ok: false,
      problem: "not_an_invoice",
    });
  });

  it("un contenedor sin la factura adentro no se puede leer", () => {
    const xml = buildDianAttachedDocumentXml().replace(/<cac:Attachment>[\s\S]*?<\/cac:Attachment>/, "");
    expect(parseDianInvoice(xml)).toEqual({ ok: false, problem: "missing_fields" });
  });
});

describe("readInvoiceXmls", () => {
  const xml = buildDianAttachedDocumentXml();

  it("saca el XML del ZIP que llega por correo e ignora el PDF", () => {
    const zip = zipSync({ "ad09001234560002600001234.xml": strToU8(xml), "fv09001234560002600001234.pdf": strToU8("%PDF-1.7") });
    expect(readInvoiceXmls(zip)).toEqual([xml]);
  });

  it("lee un XML suelto, con o sin BOM", () => {
    expect(readInvoiceXmls(strToU8(xml))).toEqual([xml]);
    expect(readInvoiceXmls(new Uint8Array([0xef, 0xbb, 0xbf, ...strToU8(xml)]))).toEqual([xml]);
  });

  it("devuelve una lista vacía si el archivo está vacío o el ZIP está dañado", () => {
    expect(readInvoiceXmls(new Uint8Array())).toEqual([]);
    expect(readInvoiceXmls(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4, 5]))).toEqual([]);
  });

  it("un ZIP sin XML no trae facturas", () => {
    expect(readInvoiceXmls(zipSync({ "factura.pdf": strToU8("%PDF-1.7") }))).toEqual([]);
  });
});
