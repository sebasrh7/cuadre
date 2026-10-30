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

export type StatementBank = "bancolombia" | "nequi" | "nu" | "nu_card";

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
  | "balance_mismatch"
  /** Tarjeta Nu con devoluciones: todavía no se sabe cómo aparecen en la tabla. */
  | "unsupported_refunds";

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
  if (/Periodo facturado/i.test(text) && /PAGO MÍNIMO/.test(text)) return parseNuCard(rows);
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

/** Celda justo debajo de `label` (misma columna), como en los encabezados de Nu. */
function valueBelow(rows: Row[], label: RegExp, value: RegExp): RegExpExecArray | null {
  for (const row of rows) {
    const labelCell = row.cells.find((c) => label.test(c.str));
    if (!labelCell) continue;
    for (const below of rows) {
      if (below.page !== row.page || below.y >= row.y || row.y - below.y > 30) continue;
      const cell = below.cells.find((c) => Math.abs(c.x - labelCell.x) < 20 && value.test(c.str));
      if (cell) return value.exec(cell.str);
    }
  }
  return null;
}

const NU_DATE = /^(\d{1,2}) ([A-Z]{3}) (\d{4})/;
const isoFromNu = (day: string, month: number, year: string) =>
  `${year}-${String(month).padStart(2, "0")}-${day.padStart(2, "0")}`;

/** Columnas de la tabla de la tarjeta Nu, en el orden en que aparecen. */
const CARD_COLUMNS = ["date", "description", "value", "installments", "monthValue", "interest", "total", "pending"] as const;
type CardColumn = (typeof CARD_COLUMNS)[number];

/**
 * El extracto de la tarjeta de crédito Nu no tiene saldos encadenados: se
 * verifica con sus propias identidades (deuda del mes + intereses + cargos −
 * abonos = pago mínimo; pago mínimo + deuda pendiente = deuda total; cada pago
 * se desglosa en capital, intereses y cargos). Las compras se registran por su
 * valor total en la fecha de compra, no por cuotas: la misma compra a 3 cuotas
 * aparece en tres extractos y debe contarse una sola vez.
 */
function parseNuCard(rows: Row[]): ParseStatementResult {
  const page1 = rows.filter((r) => r.page === 1);
  const cut = valueBelow(page1, /^Fecha de corte$/i, NU_DATE);
  const start = valueBelow(page1, /^Periodo facturado$/i, NU_DATE);
  const cutMonth = cut && MONTHS[cut[2].toLowerCase()];
  const startMonth = start && MONTHS[start[2].toLowerCase()];
  // Hay dos tarjetas (virtual y física); se toma la primera, como en el PDF.
  const accountLast4 = page1
    .flatMap((r) => r.cells.map((c) => ({ y: r.y, x: c.x, m: /^[•\s]+(\d{4})$/.exec(c.str) })))
    .filter((c) => c.m)
    .sort((a, b) => b.y - a.y || a.x - b.x)[0]?.m?.[1];
  if (!cut || !cutMonth || !start || !startMonth || !accountLast4) return { ok: false, problem: "not_a_statement" };
  const period = { from: isoFromNu(start[1], startMonth, start[3]), to: isoFromNu(cut[1], cutMonth, cut[3]) };

  // Valor de una etiqueta del resumen; las que se repiten (comisiones, cargos) se suman.
  const summary = (label: RegExp) => {
    let total: number | null = null;
    for (const row of page1) {
      const index = row.cells.findIndex((c) => label.test(c.str));
      if (index === -1) continue;
      const amount = row.cells.slice(index + 1).map((c) => colombianAmount(c.str)).find((v) => v !== null);
      if (amount !== undefined && amount !== null) total = (total ?? 0) + amount;
    }
    return total;
  };
  const due = summary(/^Deuda a pagar este mes$/);
  const minimum = summary(/^PAGO MÍNIMO$/);
  const pending = summary(/^Deuda (?!a pagar)\p{Ll}/u);
  const totalDebt = summary(/^DEUDA TOTAL/);
  if (due === null || minimum === null || pending === null || totalDebt === null) {
    return { ok: false, problem: "missing_summary" };
  }
  const interest = summary(/^Intereses$/) ?? 0;
  const fees = summary(/^Comisiones/) ?? 0;
  const charges = summary(/^Cargos/) ?? 0;
  const payments = summary(/^Abonos$/) ?? 0;
  const refunds = summary(/ajustes/i) ?? 0;

  if (due + interest + fees + charges + payments + refunds !== minimum || minimum + pending !== totalDebt) {
    return { ok: false, problem: "summary_mismatch" };
  }
  if (refunds !== 0) return { ok: false, problem: "unsupported_refunds" };

  const table = readCardTable(rows, period);
  if (!table) return { ok: false, problem: "missing_summary" };
  const purchases = table.filter((r) => r.description !== "Pago");
  const paid = table.filter((r) => r.description === "Pago");
  const purchasesTotal = purchases.reduce((t, r) => t + r.total, 0);
  const consistent =
    (purchasesTotal === due || purchasesTotal === due + interest) &&
    purchases.every((r) => r.monthValue + r.interest === r.total) &&
    paid.reduce((t, r) => t + r.total, 0) === payments &&
    paid.every((r) => r.breakdown.reduce((t, v) => t + v, 0) === r.value);
  if (!consistent) return { ok: false, problem: "totals_mismatch" };

  const extraCharges: [string, number][] = [
    ["Intereses tarjeta Nu", interest],
    ["Comisiones tarjeta Nu", fees],
    ["Cargos tarjeta Nu", charges],
  ];
  const movements: StatementMovement[] = [
    ...table.map((r) => ({
      date: r.date,
      description: r.description,
      amountCents: r.description === "Pago" ? r.value : -r.value,
      balanceCents: 0,
    })),
    ...extraCharges
      .filter(([, cents]) => cents > 0)
      .map(([description, cents]) => ({ date: period.to, description, amountCents: -cents, balanceCents: 0 })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  // Sin saldos en el PDF: el resumen común se arma con los propios movimientos
  // (ya verificados arriba) para que el servidor pueda volver a revisarlo.
  const credits = movements.filter((m) => m.amountCents > 0).reduce((t, m) => t + m.amountCents, 0);
  const debits = movements.filter((m) => m.amountCents < 0).reduce((t, m) => t - m.amountCents, 0);
  let balance = 0;
  for (const m of movements) m.balanceCents = balance += m.amountCents;

  const statement: Statement = {
    bank: "nu_card",
    ...period,
    accountLast4,
    previousBalanceCents: 0,
    currentBalanceCents: credits - debits,
    totalCreditsCents: credits,
    totalDebitsCents: debits,
    movements,
  };
  const problem = verifyStatement(statement);
  return problem ? { ok: false, problem } : { ok: true, statement };
}

interface CardRow {
  date: string;
  description: string;
  value: number;
  monthValue: number;
  interest: number;
  total: number;
  /** Desglose de un pago: a capital, a intereses, a cargos. */
  breakdown: number[];
}

interface OpenCardRow extends Omit<CardRow, "date" | "description"> {
  page: number;
  y: number;
  day: string;
  month: number;
  year: string | null;
  lines: string[];
}

/**
 * Lee la tabla de movimientos de la tarjeta. Cada movimiento empieza en un
 * renglón con fecha (`15 SEP`); en los renglones de abajo vienen el año, el
 * resto de la descripción y, en los pagos, el desglose (`↪ A capital $…`).
 */
function readCardTable(rows: Row[], period: { from: string; to: string }): CardRow[] | null {
  const sorted = [...rows].sort((a, b) => a.page - b.page || b.y - a.y);
  const result: CardRow[] = [];
  let header: { x: number; column: CardColumn }[] | null = null;
  let open: OpenCardRow | null = null;

  const close = () => {
    if (!open) return;
    // Sin año impreso: el mes decide de qué año del periodo es.
    const year =
      open.year ?? (open.month >= Number(period.from.slice(5, 7)) ? period.from.slice(0, 4) : period.to.slice(0, 4));
    result.push({
      date: isoFromNu(open.day, open.month, year),
      description: open.lines.join(" ").trim(),
      value: open.value,
      monthValue: open.monthValue,
      interest: open.interest,
      total: open.total,
      breakdown: open.breakdown,
    });
    open = null;
  };

  for (const row of sorted) {
    const texts = row.cells.map((c) => c.str);
    if (texts.includes("Descripción") && texts.includes("Cuotas")) {
      close();
      header = row.cells.slice(0, CARD_COLUMNS.length).map((c, i) => ({ x: c.x, column: CARD_COLUMNS[i] }));
      continue;
    }
    if (!header) continue;
    const columns = header;
    const columnOf = (x: number) => [...columns].reverse().find((h) => h.x <= x + 5)?.column ?? "date";
    const cellsIn = (column: CardColumn) => row.cells.filter((c) => columnOf(c.x) === column);
    const moneyIn = (column: CardColumn) => cellsIn(column).map((c) => colombianAmount(c.str)).find((v) => v !== null) ?? 0;

    const dateCell = cellsIn("date").find((c) => /^\d{1,2} [A-Z]{3}$/.test(c.str));
    const month = dateCell ? MONTHS[dateCell.str.split(" ")[1].toLowerCase()] : undefined;
    if (dateCell && month) {
      close();
      open = {
        page: row.page,
        y: row.y,
        day: dateCell.str.split(" ")[0],
        month,
        year: null,
        lines: cellsIn("description").map((c) => c.str),
        value: moneyIn("value"),
        monthValue: moneyIn("monthValue"),
        interest: moneyIn("interest"),
        total: moneyIn("total"),
        breakdown: [],
      };
      continue;
    }
    // Lo que no está pegado a un movimiento (pago mínimo, textos legales) no es parte de él.
    if (!open || open.page !== row.page || open.y - row.y > 30) {
      close();
      continue;
    }
    const year = cellsIn("date").find((c) => /^\d{4}$/.test(c.str));
    if (year) open.year = year.str;
    open.lines.push(...cellsIn("description").map((c) => c.str));
    // El desglose viene con flecha (`↪ A capital $…`); se acepta también sin ella.
    for (const cell of row.cells.filter((c) => /^(↪\s*)?A (capital|intereses|cargos)/i.test(c.str))) {
      const amount = colombianAmount(cell.str.slice(cell.str.indexOf("$")));
      if (amount !== null) open.breakdown.push(amount);
    }
  }
  close();
  return header ? result : null;
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
