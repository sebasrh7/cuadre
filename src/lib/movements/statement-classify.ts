import { centsToPesos } from "@/lib/parsers/amount";
import type { StatementBank, StatementMovement } from "@/lib/parsers/statement";

export type StatementKind =
  /** `ABONO DE GIRO INTERNACIONAL`: se concilia con los ingresos en USD. */
  | "foreign_income"
  /** Intereses de la cuenta de ahorros y sus ajustes. */
  | "interest"
  /** Envío a una billetera (Nequi): casi siempre del mismo titular, el usuario confirma. */
  | "wallet_transfer"
  /** `TRANSF A <nombre>` (Bancolombia) o `De`/`Para <nombre>` (Nequi): propia si el nombre es del usuario. */
  | "person_transfer"
  /** Movimiento que por definición es entre cuentas del mismo titular (`Recarga desde Bancolombia`). */
  | "self_transfer"
  | "expense"
  | "other_income";

export interface ClassifiedMovement {
  kind: StatementKind;
  /** Comercio, persona o entidad, sin el prefijo del banco. */
  counterparty: string | null;
}

/** Prefijos de gasto que el banco antepone al nombre del comercio. */
const EXPENSE_PREFIXES = [
  "COMPRA EN",
  "PAGO QR",
  "PAGO PSE",
  "PAGO ELECTRONICO",
  "COBRO SUSCR",
  "PAGO",
  "TRANSFERENCIA CTA",
];

export function classifyStatementMovement(m: StatementMovement, bank: StatementBank = "bancolombia"): ClassifiedMovement {
  if (bank === "nequi") return classifyNequiMovement(m);
  if (bank === "nu") return classifyNuMovement(m);
  if (bank === "nu_card") return classifyNuCardMovement(m);
  const text = m.description.toUpperCase();

  if (text.startsWith("ABONO DE GIRO INTERNACIONAL")) {
    return { kind: "foreign_income", counterparty: "Giro internacional" };
  }
  if (/^(ABONO|AJUSTE) INTERES/.test(text)) return { kind: "interest", counterparty: null };
  if (/^TRANSFERENCIAS? A NEQUI/.test(text)) return { kind: "wallet_transfer", counterparty: "Nequi" };

  const person = /^TRANSF A (.+)$/.exec(m.description);
  if (person) return { kind: "person_transfer", counterparty: person[1].trim() };

  if (m.amountCents > 0) return { kind: "other_income", counterparty: m.description || null };

  if (text.startsWith("RETIRO CAJERO")) return { kind: "expense", counterparty: "Retiro en cajero" };
  const prefix = EXPENSE_PREFIXES.find((p) => text.startsWith(p));
  const rest = prefix ? m.description.slice(prefix.length).trim() : m.description;
  return { kind: "expense", counterparty: rest || m.description || null };
}

/** Prefijos de Nequi que anteceden al comercio en un gasto. */
const NEQUI_EXPENSE_PREFIXES = [/^PAGO EN QR BRE-B:\s*/i, /^COMPRA (PIN )?(PTM )?/i, /^PAGO (EN |PTM )?/i];

function classifyNequiMovement(m: StatementMovement): ClassifiedMovement {
  const text = m.description.trim();

  if (/^Recarga desde Bancolombia/i.test(text)) return { kind: "self_transfer", counterparty: "Bancolombia" };
  if (/^Pago de Intereses/i.test(text)) return { kind: "interest", counterparty: null };

  const person = /^(?:De|Para)\s+(.+)$/i.exec(text) ?? /^ENVIO CON BRE-B A:\s*(.+)$/i.exec(text);
  if (person) return { kind: "person_transfer", counterparty: person[1].trim() };

  if (m.amountCents > 0) return { kind: "other_income", counterparty: text || null };

  const prefix = NEQUI_EXPENSE_PREFIXES.find((p) => p.test(text));
  const rest = prefix ? text.replace(prefix, "").trim() : text;
  return { kind: "expense", counterparty: rest || text || null };
}

function classifyNuMovement(m: StatementMovement): ClassifiedMovement {
  const text = m.description.trim();

  if (/^Rendimiento/i.test(text)) return { kind: "interest", counterparty: null };
  // El pago de la tarjeta Nu sale de la misma persona: no es gasto ni ingreso.
  if (/^Pagaste tu tarjeta/i.test(text)) return { kind: "self_transfer", counterparty: "Tarjeta Nu" };
  if (/^Impuesto del 4x1000/i.test(text)) return { kind: "expense", counterparty: "Impuesto 4x1000" };

  const person = /^(?:Recibiste de|Enviaste a)\s+(.+)$/i.exec(text);
  if (person) return { kind: "person_transfer", counterparty: person[1].trim() };

  if (m.amountCents > 0) return { kind: "other_income", counterparty: text || null };

  const purchase = /^Compra en\s+(.+?)(?:\s+con tarjeta d[eé]bito)?$/i.exec(text);
  return { kind: "expense", counterparty: purchase?.[1].trim() || text || null };
}

function classifyNuCardMovement(m: StatementMovement): ClassifiedMovement {
  const text = m.description.trim();

  // El pago de la tarjeta sale de otra cuenta del mismo titular.
  if (/^Pago$/i.test(text)) return { kind: "self_transfer", counterparty: "Pago tarjeta Nu" };
  if (m.amountCents > 0) return { kind: "other_income", counterparty: text || null };

  // `Spotify Pago*Spotify Bogota`: primero el nombre del comercio, luego el descriptor del pago.
  const descriptor = /^(.*?)\s*\S+\*(.+)$/.exec(text);
  const merchant = descriptor ? descriptor[1] || descriptor[2] : text;
  return { kind: "expense", counterparty: merchant.trim() || text || null };
}

export interface MonthlyInterest {
  /** `YYYY-MM` */
  month: string;
  /** Último día del mes con intereses, para fechar el movimiento agrupado. */
  lastDate: string;
  pesos: number;
}

/**
 * El banco abona intereses casi a diario, por centavos. Se agrupan por mes y
 * se suman en centavos antes de redondear, para no perder plata en el redondeo.
 */
export function groupMonthlyInterest(
  movements: StatementMovement[],
  bank: StatementBank = "bancolombia",
): MonthlyInterest[] {
  const byMonth = new Map<string, { lastDate: string; cents: number }>();
  for (const m of movements) {
    if (classifyStatementMovement(m, bank).kind !== "interest") continue;
    const month = m.date.slice(0, 7);
    const entry = byMonth.get(month) ?? { lastDate: m.date, cents: 0 };
    entry.cents += m.amountCents;
    if (m.date > entry.lastDate) entry.lastDate = m.date;
    byMonth.set(month, entry);
  }
  return [...byMonth]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, { lastDate, cents }]) => ({ month, lastDate, pesos: centsToPesos(cents) }));
}
