import { centsToPesos } from "@/lib/parsers/amount";
import type { StatementMovement } from "@/lib/parsers/bancolombia-statement";

export type StatementKind =
  /** `ABONO DE GIRO INTERNACIONAL`: se concilia con los ingresos en USD. */
  | "foreign_income"
  /** Intereses de la cuenta de ahorros y sus ajustes. */
  | "interest"
  /** Envío a una billetera (Nequi): casi siempre del mismo titular, el usuario confirma. */
  | "wallet_transfer"
  /** `TRANSF A <nombre>`: propia si el nombre es del usuario. */
  | "person_transfer"
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

export function classifyStatementMovement(m: StatementMovement): ClassifiedMovement {
  const text = m.description.toUpperCase();

  if (text.startsWith("ABONO DE GIRO INTERNACIONAL")) return { kind: "foreign_income", counterparty: null };
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
export function groupMonthlyInterest(movements: StatementMovement[]): MonthlyInterest[] {
  const byMonth = new Map<string, { lastDate: string; cents: number }>();
  for (const m of movements) {
    if (classifyStatementMovement(m).kind !== "interest") continue;
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
