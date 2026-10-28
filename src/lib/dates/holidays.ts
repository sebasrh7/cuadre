/**
 * Festivos de Colombia (Ley 51 de 1983, "Ley Emiliani"). Fechas `YYYY-MM-DD`.
 * No es una regla tributaria que cambie cada año: es un cálculo fijo por ley,
 * con tests contra el calendario publicado.
 */
export function colombianHolidays(year: number): string[] {
  const easter = easterSunday(year);
  const dates = [
    // Fijos.
    utc(year, 1, 1),
    utc(year, 5, 1),
    utc(year, 7, 20),
    utc(year, 8, 7),
    utc(year, 12, 8),
    utc(year, 12, 25),
    // Se trasladan al lunes siguiente.
    nextMonday(utc(year, 1, 6)),
    nextMonday(utc(year, 3, 19)),
    nextMonday(utc(year, 6, 29)),
    nextMonday(utc(year, 8, 15)),
    nextMonday(utc(year, 10, 12)),
    nextMonday(utc(year, 11, 1)),
    nextMonday(utc(year, 11, 11)),
    // Según la Pascua.
    addDays(easter, -3), // Jueves Santo
    addDays(easter, -2), // Viernes Santo
    nextMonday(addDays(easter, 39)), // Ascensión
    nextMonday(addDays(easter, 60)), // Corpus Christi
    nextMonday(addDays(easter, 68)), // Sagrado Corazón
  ];
  return dates.map(iso).sort();
}

/** Domingo de Pascua (algoritmo de Meeus/Jones/Butcher, calendario gregoriano). */
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return utc(year, month, day);
}

/**
 * N-ésimo día hábil del mes (lunes a viernes que no sean festivo).
 * `month` va de 1 a 12.
 */
export function nthBusinessDay(year: number, month: number, n: number): string {
  const holidays = new Set(colombianHolidays(year));
  let count = 0;
  for (let day = 1; day <= 31; day++) {
    const date = utc(year, month, day);
    if (date.getUTCMonth() !== month - 1) break;
    const weekday = date.getUTCDay();
    if (weekday === 0 || weekday === 6 || holidays.has(iso(date))) continue;
    if (++count === n) return iso(date);
  }
  throw new Error(`El mes ${year}-${month} no tiene ${n} días hábiles`);
}

function utc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

/** El mismo día si ya es lunes; si no, el lunes siguiente. */
function nextMonday(date: Date): Date {
  const weekday = date.getUTCDay();
  return weekday === 1 ? date : addDays(date, (8 - weekday) % 7);
}

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}
