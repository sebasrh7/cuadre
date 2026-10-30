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

export type StatementBank = "bancolombia" | "nequi" | "nu";

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
 * Lee un extracto de cuenta de Bancolombia, Nequi o la Cuenta Nu a partir del
 * texto del PDF con posiciones, reconociendo de qué banco es. Además de leer,
 * verifica el resultado contra el resumen del propio extracto: si algo no
 * cuadra, no devuelve datos.
 */
export function parseStatement(items: TextItem[]): ParseStatementResult {
  const rows = groupRows(items);
  const text = rowTexts(rows).join("\n");
  if (/Lo que entró a tu cuenta/i.test(text)) return parseNuAccount(rows);
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

const MONTHS: Record<string, number> = {
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, oct: 10, nov: 11, dic: 12,
};

/** Monto en formato colombiano de Nu: `+$999.999,99`, `-$999,99`, `$9,99`. */
function colombianAmount(str: string): number | null {
  const m = /^([+-])?\s?\$\s?(\d{1,3}(?:\.\d{3})*),(\d{2})$/.exec(str.trim());
  if (!m) return null;
  const cents = Number(m[2].replace(/\./g, "")) * 100 + Number(m[3]);
  return m[1] === "-" ? -cents : cents;
}

/**
 * La Cuenta Nu tiene otro formato: el resumen va en frases ("Lo que entró a tu
 * cuenta"), no hay columna de saldo, las fechas son `30 sep` y el 4x1000 y los
 * rendimientos salen en renglones sin fecha. Se verifica igual de estricto:
 * inicio + movimientos = final, y los totales del resumen contra los
 * movimientos.
 */
function parseNuAccount(rows: Row[]): ParseStatementResult {
  const texts = rowTexts(rows);
  const periodMatch = texts
    .map((t) => /(\d{1,2})\s*-\s*(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})/.exec(t))
    .find(Boolean);
  const month = periodMatch && MONTHS[periodMatch[3].toLowerCase()];
  const accountLast4 = nuAccountLast4(rows);
  if (!periodMatch || !month || !accountLast4) return { ok: false, problem: "not_a_statement" };

  const ymd = (day: number) => `${periodMatch[4]}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const period = { from: ymd(Number(periodMatch[1])), to: ymd(Number(periodMatch[2])) };

  const movementsStart = rows.findIndex((r) => r.cells.map((c) => c.str).join(" ") === "Movimientos");
  if (movementsStart === -1) return { ok: false, problem: "missing_summary" };

  const label = (pattern: RegExp) => {
    for (const row of rows.slice(0, movementsStart)) {
      const index = row.cells.findIndex((c) => pattern.test(c.str.trim()));
      if (index === -1) continue;
      const amount = row.cells.slice(index + 1).map((c) => colombianAmount(c.str)).find((v) => v !== null);
      if (amount !== undefined && amount !== null) return amount;
    }
    return null;
  };
  const start = label(/^Tu dinero al inicio del mes$/i);
  const end = label(/^Tu dinero a final del mes$/i);
  const inflow = label(/^Lo que entró a tu cuenta$/i);
  const outflow = label(/^Lo que salió de tu cuenta$/i);
  if (start === null || end === null || inflow === null || outflow === null) {
    return { ok: false, problem: "missing_summary" };
  }
  const tax = label(/^Impuesto del 4x1000$/i) ?? 0;
  const withdrawalFee = label(/por retiro$/i) ?? 0;
  const yieldCents = label(/^Rendimiento total de tu cuenta$/i) ?? 0;

  const movements: StatementMovement[] = [];
  let lastDate: string | null = null;
  for (const row of rows.slice(movementsStart + 1)) {
    const amountCell = row.cells.find((c) => colombianAmount(c.str) !== null);
    if (!amountCell) continue;
    const dateCell = row.cells.find((c) => /^\d{1,2} [a-z]{3}$/i.test(c.str));
    const description = row.cells
      .filter((c) => c !== amountCell && c !== dateCell)
      .map((c) => c.str)
      .join(" ")
      .trim();

    let date: string | null;
    if (dateCell) {
      const [day, monthName] = dateCell.str.split(" ");
      const m = MONTHS[monthName.toLowerCase()];
      date = m ? `${periodMatch[4]}-${String(m).padStart(2, "0")}-${day.padStart(2, "0")}` : null;
    } else if (/^Rendimiento/i.test(description)) {
      date = period.to;
    } else {
      // El 4x1000 sale debajo del movimiento que lo causó, sin fecha.
      date = lastDate;
    }
    if (!date) continue;
    lastDate = date;
    movements.push({ date, description, amountCents: colombianAmount(amountCell.str)!, balanceCents: 0 });
  }

  // Sin columna de saldo: se reconstruye para conservar el formato común.
  let balance = start;
  for (const m of movements) m.balanceCents = balance += m.amountCents;

  const statement: Statement = {
    bank: "nu",
    ...period,
    accountLast4,
    previousBalanceCents: start,
    currentBalanceCents: end,
    totalCreditsCents: inflow + yieldCents,
    totalDebitsCents: Math.abs(outflow) + Math.abs(tax) + Math.abs(withdrawalFee),
    movements,
  };
  const problem = verifyStatement(statement);
  return problem ? { ok: false, problem } : { ok: true, statement };
}

/** El número de cuenta va justo debajo de la etiqueta "Número de Cuenta". */
function nuAccountLast4(rows: Row[]): string | null {
  for (const row of rows) {
    const labelCell = row.cells.find((c) => /^Número de Cuenta$/i.test(c.str));
    if (!labelCell) continue;
    for (const below of rows) {
      if (below.page !== row.page || below.y >= row.y || row.y - below.y > 30) continue;
      const value = below.cells.find((c) => Math.abs(c.x - labelCell.x) < 20 && /^\d{6,14}$/.test(c.str));
      if (value) return value.str.slice(-4);
    }
  }
  return null;
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
