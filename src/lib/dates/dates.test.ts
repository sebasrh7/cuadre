import { describe, expect, it } from "vitest";
import { colombianHolidays, easterSunday, nthBusinessDay } from "./holidays";
import { buildIcs } from "./ics";
import { pilaBusinessDay, pilaDueFor, upcomingPilaDues, type PilaDeadlineRule } from "./pila";

describe("colombianHolidays", () => {
  it("calcula la Pascua", () => {
    expect(easterSunday(2026).toISOString().slice(0, 10)).toBe("2026-04-05");
    expect(easterSunday(2027).toISOString().slice(0, 10)).toBe("2027-03-28");
  });

  it("coincide con los 18 festivos publicados de 2026", () => {
    expect(colombianHolidays(2026)).toEqual([
      "2026-01-01",
      "2026-01-12",
      "2026-03-23",
      "2026-04-02",
      "2026-04-03",
      "2026-05-01",
      "2026-05-18",
      "2026-06-08",
      "2026-06-15",
      "2026-06-29",
      "2026-07-20",
      "2026-08-07",
      "2026-08-17",
      "2026-10-12",
      "2026-11-02",
      "2026-11-16",
      "2026-12-08",
      "2026-12-25",
    ]);
  });
});

describe("nthBusinessDay", () => {
  it("salta fines de semana y festivos", () => {
    // Noviembre 2026: 1 domingo, 2 festivo (Todos los Santos) → 3 es el primer día hábil.
    expect(nthBusinessDay(2026, 11, 1)).toBe("2026-11-03");
    expect(nthBusinessDay(2026, 11, 2)).toBe("2026-11-04");
    // Enero 2027: 1 festivo, 2-3 fin de semana, 11 festivo (Reyes).
    expect(nthBusinessDay(2027, 1, 1)).toBe("2027-01-04");
    expect(nthBusinessDay(2027, 1, 6)).toBe("2027-01-12");
  });
});

// Tabla del Decreto 1990 de 2016 (copia de la migración).
const rules: PilaDeadlineRule[] = [
  [0, 7, 2], [8, 14, 3], [15, 21, 4], [22, 28, 5], [29, 35, 6], [36, 42, 7], [43, 49, 8], [50, 56, 9],
  [57, 63, 10], [64, 69, 11], [70, 75, 12], [76, 81, 13], [82, 87, 14], [88, 93, 15], [94, 99, 16],
].map(([digits_from, digits_to, business_day]) => ({ digits_from, digits_to, business_day }));

describe("PILA", () => {
  it.each([
    [0, 2],
    [7, 2],
    [8, 3],
    [69, 11],
    [70, 12],
    [99, 16],
  ])("dígitos %i → día hábil %i", (digits, day) => {
    expect(pilaBusinessDay(digits, rules)).toBe(day);
  });

  it("paga mes vencido: los ingresos de octubre vencen en noviembre", () => {
    expect(pilaDueFor("2026-10", 2)).toEqual({ periodMonth: "2026-10", dueDate: "2026-11-04" });
  });

  it("los de diciembre vencen en enero del año siguiente", () => {
    expect(pilaDueFor("2026-12", 2).dueDate).toBe("2027-01-05");
  });

  it("lista las próximas fechas sin incluir las ya vencidas", () => {
    // El 28 de octubre ya pasó el plazo de septiembre (5 de octubre para el día hábil 3).
    expect(upcomingPilaDues("2026-10-28", 3, 2)).toEqual([
      { periodMonth: "2026-10", dueDate: "2026-11-05" },
      { periodMonth: "2026-11", dueDate: "2026-12-03" },
    ]);
  });

  it("incluye la del mes anterior si aún no vence", () => {
    expect(upcomingPilaDues("2026-11-02", 3, 1)).toEqual([{ periodMonth: "2026-10", dueDate: "2026-11-05" }]);
  });
});

describe("buildIcs", () => {
  const ics = buildIcs(
    "Cuadre",
    [
      {
        uid: "pila-2026-10@cuadre",
        date: "2026-11-05",
        summary: "Pagar PILA, aportes de octubre",
        description: "Fecha límite; tu operador de PILA, por ejemplo.",
        remindDaysBefore: 2,
      },
    ],
    new Date("2026-10-28T12:00:00Z"),
  );

  it("usa CRLF y eventos de día completo", () => {
    expect(ics).toContain("\r\nDTSTART;VALUE=DATE:20261105\r\n");
    expect(ics).toContain("\r\nDTEND;VALUE=DATE:20261106\r\n");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("escapa comas y punto y coma", () => {
    expect(ics).toContain("SUMMARY:Pagar PILA\\, aportes de octubre");
    expect(ics).toContain("DESCRIPTION:Fecha límite\\; tu operador de PILA\\, por ejemplo.");
  });

  it("avisa a las 9:00 a. m. de Colombia, 2 días antes", () => {
    expect(ics).toContain("TRIGGER:-PT63H");
  });

  it("ninguna línea pasa de 75 octetos", () => {
    for (const line of ics.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  });
});
