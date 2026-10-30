import { centsToPesos } from "@/lib/parsers/amount";
import type { Statement } from "@/lib/parsers/statement";
import { normalizeName } from "./own-transfer";
import { classifyStatementMovement, groupMonthlyInterest, type StatementKind } from "./statement-classify";

export const FOREIGN_INCOME_CATEGORY = "Ingreso del exterior";
export const INTEREST_CATEGORY = "Intereses";
/** Pagos a personas: se categorizan aquí para que sus nombres nunca lleguen a la IA. */
export const TRANSFER_CATEGORY = "Transferencias";
export const CASH_CATEGORY = "Efectivo";

/** Lo que el usuario confirma en la vista previa. */
export interface ImportDecisions {
  /** Las transferencias a Nequi van a una cuenta propia. */
  nequiIsOwn: boolean;
  /** Nombres de `TRANSF A <nombre>` que son del mismo usuario. */
  ownPersonNames: string[];
}

export interface PlannedMovement {
  occurredOn: string;
  amountCop: number;
  direction: "in" | "out";
  kind: "income" | "expense" | "own_transfer";
  counterparty: string | null;
  category: string | null;
  accountLast4: string;
  /** Identifica el movimiento entre importaciones; el servidor lo convierte en hash. */
  dedupeKey: string;
}

/**
 * Convierte un extracto ya verificado en los movimientos a guardar. Los
 * intereses diarios se agrupan en uno por mes; el resto queda uno a uno.
 */
export function planStatementImport(statement: Statement, decisions: ImportDecisions): PlannedMovement[] {
  const ownNames = new Set(decisions.ownPersonNames.map(normalizeName));
  const last4 = statement.accountLast4;
  const planned: PlannedMovement[] = [];
  // Dos compras idénticas el mismo día son movimientos distintos: se numeran.
  const seen = new Map<string, number>();

  for (const m of statement.movements) {
    const { kind, counterparty } = classifyStatementMovement(m, statement.bank);
    if (kind === "interest") continue;

    const pesos = centsToPesos(Math.abs(m.amountCents));
    if (pesos === 0) continue;

    const direction = m.amountCents > 0 ? "in" : "out";
    const isOwn =
      kind === "self_transfer" ||
      (kind === "wallet_transfer" && decisions.nequiIsOwn) ||
      (kind === "person_transfer" && counterparty !== null && ownNames.has(normalizeName(counterparty)));

    // Bancolombia conserva su formato original de clave (no cambiar: rompería el dedupe).
    const source = statement.bank === "bancolombia" ? "statement" : `statement|${statement.bank}`;
    const base = `${source}|${last4}|${m.date}|${m.amountCents}|${m.description}`;
    const occurrence = seen.get(base) ?? 0;
    seen.set(base, occurrence + 1);

    planned.push({
      occurredOn: m.date,
      amountCop: pesos,
      direction,
      kind: isOwn ? "own_transfer" : direction === "in" ? "income" : "expense",
      counterparty,
      category: isOwn ? null : categoryFor(kind, counterparty, direction),
      accountLast4: last4,
      dedupeKey: `${base}|${occurrence}`,
    });
  }

  for (const interest of groupMonthlyInterest(statement.movements, statement.bank)) {
    if (interest.pesos <= 0) continue;
    planned.push({
      occurredOn: interest.lastDate,
      amountCop: interest.pesos,
      direction: "in",
      kind: "income",
      counterparty: "Bancolombia",
      category: INTEREST_CATEGORY,
      accountLast4: last4,
      dedupeKey:
        statement.bank === "bancolombia"
          ? `statement-interest|${last4}|${interest.month}`
          : `statement-interest|${statement.bank}|${last4}|${interest.month}`,
    });
  }

  return planned.sort((a, b) => a.occurredOn.localeCompare(b.occurredOn));
}

function categoryFor(kind: StatementKind, counterparty: string | null, direction: "in" | "out"): string | null {
  if (kind === "foreign_income") return FOREIGN_INCOME_CATEGORY;
  // Lo recibido de otra persona es un ingreso, no un gasto en transferencias.
  if ((kind === "person_transfer" || kind === "wallet_transfer") && direction === "out") return TRANSFER_CATEGORY;
  if (kind === "expense" && counterparty === "Retiro en cajero") return CASH_CATEGORY;
  // El resto de gastos queda sin categoría: lo resuelven las reglas o la IA.
  return null;
}

export interface StatementGiro {
  movementId: string;
  occurredOn: string;
  amountCop: number;
}

export interface PendingForeignIncome {
  id: string;
  receivedOn: string;
  /** Movimiento manual creado al registrar el ingreso con su abono en COP. */
  manualMovement: { id: string; amountCop: number } | null;
}

export interface ForeignIncomeLink {
  incomeId: string;
  movementId: string;
  /** El abono manual queda reemplazado por el del extracto. */
  replacesManualMovementId: string | null;
}

const MAX_DAYS_APART = 5;

/**
 * Enlaza los ingresos en USD registrados a mano con los `ABONO DE GIRO
 * INTERNACIONAL` del extracto. Si el ingreso tiene el abono en COP, debe
 * coincidir el monto exacto; si no, se toma el giro más cercano en fecha.
 * Ante un empate no se adivina: queda sin enlazar.
 */
export function reconcileForeignIncomes(
  giros: StatementGiro[],
  incomes: PendingForeignIncome[],
): ForeignIncomeLink[] {
  const used = new Set<string>();
  const links: ForeignIncomeLink[] = [];

  // Primero los que tienen monto en COP: son los que se pueden enlazar con certeza.
  const ordered = [...incomes].sort((a, b) => Number(!a.manualMovement) - Number(!b.manualMovement));

  for (const income of ordered) {
    const candidates = giros
      .filter((g) => !used.has(g.movementId))
      .filter((g) => daysApart(g.occurredOn, income.receivedOn) <= MAX_DAYS_APART)
      .filter((g) => !income.manualMovement || g.amountCop === income.manualMovement.amountCop)
      .map((g) => ({ giro: g, distance: daysApart(g.occurredOn, income.receivedOn) }))
      .sort((a, b) => a.distance - b.distance);

    const [best, second] = candidates;
    if (!best || (second && second.distance === best.distance)) continue;

    used.add(best.giro.movementId);
    links.push({
      incomeId: income.id,
      movementId: best.giro.movementId,
      replacesManualMovementId: income.manualMovement?.id ?? null,
    });
  }
  return links;
}

function daysApart(a: string, b: string): number {
  return Math.abs(Date.parse(a) - Date.parse(b)) / 86_400_000;
}
