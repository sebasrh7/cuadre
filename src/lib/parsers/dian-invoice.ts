import { XMLParser } from "fast-xml-parser";
import { z } from "zod";

/**
 * Lo único que se guarda de una factura electrónica. Del comprador (nombre,
 * documento, dirección) no se conserva nada, ni tampoco el detalle de lo comprado.
 */
export const dianInvoiceSchema = z.object({
  /** Código único de la factura (CUFE) o del documento equivalente (CUDE), en minúsculas. */
  cufe: z.string().regex(/^[0-9a-f]{40,128}$/),
  /** Prefijo y número, como los escribe el vendedor. */
  number: z.string().min(1).max(40),
  issuedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** NIT del vendedor, sin dígito de verificación. */
  issuerNit: z.string().regex(/^\d{5,15}$/),
  issuerName: z.string().min(1).max(120),
  /** Total a pagar en pesos enteros. */
  totalCop: z.number().int().positive().safe(),
});

export type DianInvoice = z.infer<typeof dianInvoiceSchema>;

export type DianInvoiceProblem =
  /** No es un XML de facturación electrónica de la DIAN. */
  | "not_an_invoice"
  /** Nota crédito o débito: corrige una factura, no es un gasto nuevo. */
  | "adjustment_note"
  | "foreign_currency"
  /** Es una factura, pero le falta algún dato o no tiene el formato esperado. */
  | "missing_fields";

export type DianInvoiceResult = { ok: true; invoice: DianInvoice } | { ok: false; problem: DianInvoiceProblem };

type Node = Record<string, unknown>;

const parser = new XMLParser({
  // `cbc:ID` → `ID`: cada proveedor tecnológico elige sus prefijos.
  removeNSPrefix: true,
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  // Todo queda como texto: los montos se convierten aquí, sin pasar por `float`.
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
});

/**
 * Lee una factura electrónica de venta (UBL 2.1, anexo técnico de la DIAN).
 * Acepta la factura sola (`Invoice`) o dentro del contenedor que llega por
 * correo (`AttachedDocument`, con la factura como texto en su `Attachment`).
 */
export function parseDianInvoice(xml: string): DianInvoiceResult {
  const root = parse(xml);
  if (!root) return { ok: false, problem: "not_an_invoice" };

  if (isNode(root.Invoice)) return readInvoice(root.Invoice);
  if (root.CreditNote || root.DebitNote) return { ok: false, problem: "adjustment_note" };
  if (!isNode(root.AttachedDocument)) return { ok: false, problem: "not_an_invoice" };

  // El contenedor trae dos adjuntos: la factura (hijo directo) y la respuesta
  // de la DIAN (dentro de ParentDocumentLineReference). Solo interesa el primero.
  const embedded = text(child(child(root.AttachedDocument, "Attachment"), "ExternalReference")?.Description);
  const inner = embedded ? parse(embedded) : null;
  if (isNode(inner?.Invoice)) return readInvoice(inner.Invoice);
  if (inner?.CreditNote || inner?.DebitNote) return { ok: false, problem: "adjustment_note" };
  return { ok: false, problem: "missing_fields" };
}

function readInvoice(invoice: Node): DianInvoiceResult {
  const payable = child(invoice, "LegalMonetaryTotal")?.PayableAmount;
  const currency = attribute(payable, "currencyID") ?? text(invoice.DocumentCurrencyCode);
  if (currency && currency.toUpperCase() !== "COP") return { ok: false, problem: "foreign_currency" };

  const supplier = child(child(invoice, "AccountingSupplierParty"), "Party");
  const tax = child(supplier, "PartyTaxScheme");
  const legal = child(supplier, "PartyLegalEntity");

  const parsed = dianInvoiceSchema.safeParse({
    cufe: text(invoice.UUID)?.toLowerCase(),
    number: text(invoice.ID),
    issuedOn: text(invoice.IssueDate)?.slice(0, 10),
    issuerNit: (text(tax?.CompanyID) ?? text(legal?.CompanyID))?.replace(/\D/g, ""),
    issuerName: (text(tax?.RegistrationName) ?? text(legal?.RegistrationName) ?? text(child(supplier, "PartyName")?.Name))
      ?.replace(/\s+/g, " ")
      .slice(0, 120),
    totalCop: decimalToPesos(text(payable)),
  });
  return parsed.success ? { ok: true, invoice: parsed.data } : { ok: false, problem: "missing_fields" };
}

/** `45900.00` → 45900. Se redondea en centavos enteros, nunca con `float`. */
function decimalToPesos(raw: string | undefined): number | undefined {
  const match = /^(\d{1,15})(?:\.(\d+))?$/.exec(raw ?? "");
  if (!match) return undefined;
  const cents = Number(match[2]?.slice(0, 2).padEnd(2, "0") ?? "0");
  return Number(match[1]) + (cents >= 50 ? 1 : 0);
}

function parse(xml: string): Node | null {
  try {
    const result: unknown = parser.parse(xml);
    return isNode(result) ? result : null;
  } catch {
    return null;
  }
}

function isNode(value: unknown): value is Node {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Hijo con ese nombre; si se repite, el primero. */
function child(node: unknown, name: string): Node | undefined {
  if (!isNode(node)) return undefined;
  const value = node[name];
  const first = Array.isArray(value) ? value[0] : value;
  return isNode(first) ? first : undefined;
}

/** Texto de un elemento, tenga atributos (`#text`) o no. */
function text(value: unknown): string | undefined {
  const first = Array.isArray(value) ? value[0] : value;
  const raw = isNode(first) ? first["#text"] : first;
  return typeof raw === "string" && raw.trim() ? raw.trim() : undefined;
}

function attribute(value: unknown, name: string): string | undefined {
  const first = Array.isArray(value) ? value[0] : value;
  const raw = isNode(first) ? first[`@_${name}`] : undefined;
  return typeof raw === "string" && raw.trim() ? raw.trim() : undefined;
}
