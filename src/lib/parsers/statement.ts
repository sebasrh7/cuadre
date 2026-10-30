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

export type StatementBank = "bancolombia" | "nequi";

export interface Statement {
  bank: StatementBank;
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
const AMOUNT = /^-?(\d{1,3}(,\d{3})*)?\.\d{2}$/;

type Cell = { x: number; str: string };
type Row = { page: number; y: number; cells: Cell[] };
type Period = { from: string; to: string };

/**
 * Lo que cambia entre bancos del mismo grupo (Bancolombia y Nequi comparten
 * resumen y columnas): cómo reconocer el extracto, el periodo, la cuenta y el
 * formato de la fecha de cada movimiento.
 */
interface StatementFormat {
  bank: StatementBank;
  recognizes: (text: string) => boolean;
  findPeriod: (rows: Row[]) => Period | null;
  findAccountLast4: (rows: Row[]) => string | null;
  rowDate: (cell: string, period: Period) => string | null;
  /** Nequi lista del más reciente al más antiguo; se invierte para encadenar saldos. */
  newestFirst?: boolean;
}

const bancolombia: StatementFormat = {
  bank: "bancolombia",
  recognizes: (text) => /DESDE:/.test(text) && /HASTA:/.test(text),
  findPeriod: (rows) => {
    for (const text of rowTexts(rows)) {
      if (!/DESDE:/.test(text) || !/HASTA:/.test(text)) continue;
      const dates = [...text.matchAll(/(\d{4})\/(\d{2})\/(\d{2})/g)];
      if (dates.length >= 2) return { from: isoOf(dates[0]), to: isoOf(dates[1]) };
    }
    return null;
  },
  // El número de cuenta aparece solo, en una celda del encabezado.
  findAccountLast4: (rows) => firstMatch(rows, /^(\d{9,14})$/),
  // `D/MM`, sin año.
  rowDate: (cell, period) => {
    const date = /^(\d{1,2})\/(\d{2})$/.exec(cell);
    return date ? resolveDate(Number(date[1]), Number(date[2]), period) : null;
  },
};

const nequi: StatementFormat = {
  bank: "nequi",
  recognizes: (text) => /NEQUI S\.A\./i.test(text),
  findPeriod: (rows) => {
    for (const text of rowTexts(rows)) {
      const m = /per[ií]odo de:\s*(\d{4})\/(\d{2})\/(\d{2})\s+a\s+(\d{4})\/(\d{2})\/(\d{2})/i.exec(text);
      if (m) return { from: `${m[1]}-${m[2]}-${m[3]}`, to: `${m[4]}-${m[5]}-${m[6]}` };
    }
    return null;
  },
  // El número (el celular) va al final de una etiqueta: "…: 3001234567".
  findAccountLast4: (rows) => firstMatch(rows, /:\s*(\d{9,14})$/),
  // `DD/MM/AAAA`, completa.
  rowDate: (cell) => {
    const date = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(cell);
    return date ? `${date[3]}-${date[2]}-${date[1]}` : null;
  },
  newestFirst: true,
};

const FORMATS = [nequi, bancolombia];

/**
 * Lee un extracto de cuenta de Bancolombia o de Nequi a partir del texto del
 * PDF con posiciones, reconociendo de qué banco es. Además de leer, verifica el
 * resultado contra el resumen del propio extracto: si algo no cuadra, no
 * devuelve datos.
 */
export function parseStatement(items: TextItem[]): ParseStatementResult {
  const rows = groupRows(items);
  const text = rowTexts(rows).join("\n");
  const format = FORMATS.find((f) => f.recognizes(text));
  return format ? parseWith(format, rows) : { ok: false, problem: "not_a_statement" };
}

/** Lee el extracto como de Bancolombia, sin detectar el banco. */
export function parseBancolombiaStatement(items: TextItem[]): ParseStatementResult {
  return parseWith(bancolombia, groupRows(items));
}

function parseWith(format: StatementFormat, rows: Row[]): ParseStatementResult {
  const period = format.findPeriod(rows);
  const accountLast4 = format.findAccountLast4(rows);
  if (!period || !accountLast4) return { ok: false, problem: "not_a_statement" };

  const summary = findSummary(rows);
  if (!summary) return { ok: false, problem: "missing_summary" };

  const movements: StatementMovement[] = [];
  for (const row of rows) {
    const movement = readMovement(row, period, format);
    if (movement) movements.push(movement);
  }
  if (format.newestFirst) movements.reverse();

  const statement: Statement = { bank: format.bank, ...period, accountLast4, ...summary, movements };
  const problem = verifyStatement(statement);
  return problem ? { ok: false, problem } : { ok: true, statement };
}

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

function rowTexts(rows: Row[]): string[] {
  return rows.map((row) => row.cells.map((c) => c.str).join(" "));
}

/** Solo se guardan los últimos 4 dígitos de la cuenta. */
function firstMatch(rows: Row[], pattern: RegExp): string | null {
  for (const row of rows) {
    for (const cell of row.cells) {
      const m = pattern.exec(cell.str);
      if (m) return m[1].slice(-4);
    }
  }
  return null;
}

function isoOf(m: RegExpMatchArray): string {
  return `${m[1]}-${m[2]}-${m[3]}`;
}

/**
 * Monto de una celda, en centavos, o `null` si no es un monto. Bancolombia lo
 * escribe sin signo de pesos (`-99,999.99`); Nequi con él (`$-99,999.99`).
 */
function cellAmount(str: string): number | null {
  const bare = str.replace(/^\$\s?/, "");
  return AMOUNT.test(bare) ? parseStatementCents(bare) : null;
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
      const index = row.cells.findIndex((c) => c.str.toUpperCase() === label);
      if (index === -1) continue;
      const amount = row.cells
        .slice(index + 1)
        .map((c) => cellAmount(c.str))
        .find((v) => v !== null);
      if (amount !== undefined && amount !== null) summary[key] = amount;
      break;
    }
  }
  const complete = Object.keys(SUMMARY_LABELS).every((k) => summary[k as keyof Summary] !== undefined);
  return complete ? (summary as Summary) : null;
}

/**
 * Un movimiento empieza con una fecha y termina con dos montos: valor y saldo.
 * Lo que hay en medio es la descripción (las columnas de sucursal y documento
 * de Bancolombia vienen vacías en este tipo de cuenta).
 */
function readMovement(row: Row, period: Period, format: StatementFormat): StatementMovement | null {
  const [first, ...rest] = row.cells;
  const date = first && format.rowDate(first.str, period);
  if (!date) return null;

  const amounts = rest.filter((c) => cellAmount(c.str) !== null);
  if (amounts.length < 2) return null;
  const [valueCell, balanceCell] = amounts.slice(-2);

  const description = rest
    .filter((c) => c.x < valueCell.x && cellAmount(c.str) === null)
    .map((c) => c.str)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    // La fuente del extracto dibuja la ñ como "|" ("MU|OZ", "Mu|oz") o, en
    // pagos QR, como "#" entre letras ("PI#A").
    .replace(/(\p{L})#(?=\p{L})/gu, "$1|")
    .replace(/(\p{L}?)\|/gu, (_, before: string) => `${before}${before && before === before.toLowerCase() ? "ñ" : "Ñ"}`);

  return {
    date,
    description,
    amountCents: cellAmount(valueCell.str)!,
    balanceCents: cellAmount(balanceCell.str)!,
  };
}

/**
 * Los movimientos de Bancolombia no traen año: se toma del periodo. Si el
 * periodo cruza de año (diciembre → enero), los meses menores al mes inicial
 * son del año final.
 */
function resolveDate(day: number, month: number, period: Period): string {
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
