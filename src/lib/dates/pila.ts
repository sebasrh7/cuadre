import { nthBusinessDay } from "./holidays";

export interface PilaDeadlineRule {
  digits_from: number;
  digits_to: number;
  business_day: number;
}

/** Día hábil de pago según los dos últimos dígitos del documento. */
export function pilaBusinessDay(lastTwo: number, rules: PilaDeadlineRule[]): number {
  const rule = rules.find((r) => lastTwo >= r.digits_from && lastTwo <= r.digits_to);
  if (!rule) throw new Error(`Sin plazo de PILA para los dígitos ${lastTwo}`);
  return rule.business_day;
}

export interface PilaDue {
  /** Mes de los ingresos que se cotizan (`YYYY-MM`). */
  periodMonth: string;
  /** Fecha límite de pago (`YYYY-MM-DD`). */
  dueDate: string;
}

/**
 * Los independientes pagan mes vencido: los ingresos de octubre se cotizan en
 * la PILA que vence en noviembre, el día hábil que corresponda.
 */
export function pilaDueFor(periodMonth: string, businessDay: number): PilaDue {
  const [year, month] = periodMonth.split("-").map(Number);
  const payYear = month === 12 ? year + 1 : year;
  const payMonth = month === 12 ? 1 : month + 1;
  return { periodMonth, dueDate: nthBusinessDay(payYear, payMonth, businessDay) };
}

/**
 * Próximas fechas desde `today`: la primera es la del mes anterior si su
 * vencimiento todavía no pasó.
 */
export function upcomingPilaDues(today: string, businessDay: number, count: number): PilaDue[] {
  const [year, month] = today.split("-").map(Number);
  let period = shiftMonth(`${year}-${String(month).padStart(2, "0")}`, -1);
  const dues: PilaDue[] = [];
  while (dues.length < count) {
    const due = pilaDueFor(period, businessDay);
    if (due.dueDate >= today) dues.push(due);
    period = shiftMonth(period, 1);
  }
  return dues;
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const index = y * 12 + (m - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}
