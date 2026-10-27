import { parseStatementCents } from "./amount";

/** Un fragmento de texto del PDF con su posición (como lo entrega pdf.js). */
export interface TextItem {
  page: number;
  x: number;
  y: number;
  str: string;
}

export interface StatementMovement {
  /** `YYYY-MM-DD` */
  date: string;
  description: string;
  /** Positivo = abono, negativo = cargo. */
  amountCents: number;
  balanceCents: number;
}

export interface Statement {
  /** Fechas `YYYY-MM-DD` del periodo. */
  from: string;
  to: string;
  accountLast4: string;
  previousBalanceCents: number;
  currentBalanceCents: number;
  totalCreditsCents: number;
  totalDebitsCents: number;
  movements: StatementMovement[];
}

export type StatementProblem =
  | "not_a_statement"
  | "missing_summary"
  | "summary_mismatch"
  | "totals_mismatch"
  | "balance_mismatch";

export type ParseStatementResult =
  | { ok: true; statement: Statement }
  | { ok: false; problem: StatementProblem };

const ROW_TOLERANCE = 2;
const DATE = /^(\d{1,2})\/(\d{2})$/;
const AMOUNT = /^-?(\d{1,3}(,\d{3})*)?\.\d{2}$/;
const PERIOD_DATE = /(\d{4})\/(\d{2})\/(\d{2})/;

/**
 * Lee el extracto de cuenta de ahorros de Bancolombia a partir del texto del
 * PDF con posiciones. Además de leer, verifica el resultado contra el resumen
 * del propio extracto: si algo no cuadra, no devuelve datos.
 */
export function parseBancolombiaStatement(items: TextItem[]): ParseStatementResult {
  const rows = groupRows(items);

  const period = findPeriod(rows);
  const accountLast4 = findAccountLast4(rows);
  if (!period || !accountLast4) return { ok: false, problem: "not_a_statement" };

  const summary = findSummary(rows);
  if (!summary) return { ok: false, problem: "missing_summary" };

  const movements: StatementMovement[] = [];
  for (const row of rows) {
    const movement = readMovement(row, period);
    if (movement) movements.push(movement);
  }

  const statement: Statement = { ...period, accountLast4, ...summary, movements };
  const problem = verifyStatement(statement);
  return problem ? { ok: false, problem } : { ok: true, statement };
}

type Cell = { x: number; str: string };
type Row = { page: number; y: number; cells: Cell[] };

/** Agrupa los fragmentos por renglón (misma página y altura) y los ordena. */
function groupRows(items: TextItem[]): Row[] {
  const rows: Row[] = [];
  for (const item of items) {
    const str = item.str.trim();
    if (!str) continue;
    let row = rows.find((r) => r.page === item.page && Math.abs(r.y - item.y) <= ROW_TOLERANCE);
    if (!row) {
      row = { page: item.page, y: item.y, cells: [] };
      rows.push(row);
    }
    row.cells.push({ x: item.x, str });
  }
  for (const row of rows) row.cells.sort((a, b) => a.x - b.x);
  // Página ascendente y, dentro de la página, de arriba hacia abajo.
  return rows.sort((a, b) => a.page - b.page || b.y - a.y);
}

function findPeriod(rows: Row[]): { from: string; to: string } | null {
  for (const row of rows) {
    const text = row.cells.map((c) => c.str).join(" ");
    if (!/DESDE:/.test(text) || !/HASTA:/.test(text)) continue;
    const dates = [...text.matchAll(new RegExp(PERIOD_DATE, "g"))];
    if (dates.length < 2) continue;
    const toIso = (m: RegExpMatchArray) => `${m[1]}-${m[2]}-${m[3]}`;
    return { from: toIso(dates[0]), to: toIso(dates[1]) };
  }
  return null;
}

/** El número de cuenta aparece completo en el encabezado; solo se guardan 4 dígitos. */
function findAccountLast4(rows: Row[]): string | null {
  for (const row of rows) {
    for (const cell of row.cells) {
      if (/^\d{9,14}$/.test(cell.str)) return cell.str.slice(-4);
    }
  }
  return null;
}

const SUMMARY_LABELS = {
  previousBalanceCents: "SALDO ANTERIOR",
  totalCreditsCents: "TOTAL ABONOS",
  totalDebitsCents: "TOTAL CARGOS",
  currentBalanceCents: "SALDO ACTUAL",
} as const;

type Summary = Record<keyof typeof SUMMARY_LABELS, number>;

/** En cada renglón del resumen, el monto es el primer número a la derecha de la etiqueta. */
function findSummary(rows: Row[]): Summary | null {
  const summary: Partial<Summary> = {};
  for (const [key, label] of Object.entries(SUMMARY_LABELS) as [keyof Summary, string][]) {
    for (const row of rows) {
      const index = row.cells.findIndex((c) => c.str === label);
      if (index === -1) continue;
      const amount = row.cells.slice(index + 1).find((c) => AMOUNT.test(c.str));
      if (amount) summary[key] = parseStatementCents(amount.str);
      break;
    }
  }
  const complete = Object.keys(SUMMARY_LABELS).every((k) => summary[k as keyof Summary] !== undefined);
  return complete ? (summary as Summary) : null;
}

/**
 * Un movimiento empieza con una fecha `D/MM` y termina con dos montos: valor y
 * saldo. Lo que hay en medio es la descripción (las columnas de sucursal y
 * documento vienen vacías en este tipo de cuenta).
 */
function readMovement(row: Row, period: { from: string; to: string }): StatementMovement | null {
  const [first, ...rest] = row.cells;
  const date = first && DATE.exec(first.str);
  if (!date) return null;

  const amounts = rest.filter((c) => AMOUNT.test(c.str));
  if (amounts.length < 2) return null;
  const [valueCell, balanceCell] = amounts.slice(-2);

  const description = rest
    .filter((c) => c.x < valueCell.x && !AMOUNT.test(c.str))
    .map((c) => c.str)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    // La fuente del extracto dibuja la ñ como "|" ("MU|OZ", "Mu|oz").
    .replace(/(\p{L}?)\|/gu, (_, before: string) => `${before}${before && before === before.toLowerCase() ? "ñ" : "Ñ"}`);

  return {
    date: resolveDate(Number(date[1]), Number(date[2]), period),
    description,
    amountCents: parseStatementCents(valueCell.str),
    balanceCents: parseStatementCents(balanceCell.str),
  };
}

/**
 * Los movimientos no traen año: se toma del periodo. Si el periodo cruza de
 * año (diciembre → enero), los meses menores al mes inicial son del año final.
 */
function resolveDate(day: number, month: number, period: { from: string; to: string }): string {
  const [fromYear, fromMonth] = period.from.split("-").map(Number);
  const toYear = Number(period.to.slice(0, 4));
  const year = month < fromMonth ? toYear : fromYear;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Comprueba que el extracto cuadre consigo mismo. Se exporta para que el
 * servidor la vuelva a correr sobre lo que envía el navegador.
 */
export function verifyStatement(s: Statement): StatementProblem | null {
  if (s.previousBalanceCents + s.totalCreditsCents - s.totalDebitsCents !== s.currentBalanceCents) {
    return "summary_mismatch";
  }

  const credits = s.movements.filter((m) => m.amountCents > 0).reduce((t, m) => t + m.amountCents, 0);
  const debits = s.movements.filter((m) => m.amountCents < 0).reduce((t, m) => t - m.amountCents, 0);
  if (credits !== s.totalCreditsCents || debits !== s.totalDebitsCents) return "totals_mismatch";

  // Cada saldo debe ser el anterior más el valor del movimiento.
  let balance = s.previousBalanceCents;
  for (const m of s.movements) {
    balance += m.amountCents;
    if (balance !== m.balanceCents) return "balance_mismatch";
  }
  return null;
}
