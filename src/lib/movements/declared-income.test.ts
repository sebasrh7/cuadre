import { describe, expect, it } from "vitest";
import { declaredIncomeKey, declaredToReplace, lastDayOfMonth, suggestedIncome } from "./declared-income";

describe("lastDayOfMonth", () => {
  it.each([
    ["2026-10", "2026-10-31"],
    ["2026-11", "2026-11-30"],
    ["2028-02", "2028-02-29"],
    ["2026-12", "2026-12-31"],
  ])("%s → %s", (month, day) => {
    expect(lastDayOfMonth(month)).toBe(day);
  });
});

describe("declaredToReplace", () => {
  const declared = [
    { id: "oct", occurredOn: "2026-10-31" },
    { id: "nov", occurredOn: "2026-11-30" },
  ];

  it("el extracto reemplaza lo declarado en los meses en que trae ingresos", () => {
    const imported = [
      { occurredOn: "2026-10-15", kind: "income" },
      { occurredOn: "2026-11-03", kind: "expense" },
    ];
    expect(declaredToReplace(declared, imported)).toEqual(["oct"]);
  });

  it("un extracto sin ingresos (otra cuenta) no borra lo declarado", () => {
    expect(declaredToReplace(declared, [{ occurredOn: "2026-10-15", kind: "received" }])).toEqual([]);
  });
});

describe("suggestedIncome", () => {
  it("promedia los meses completos y redondea a miles", () => {
    expect(suggestedIncome([2_550_874, 1_700_057, 1_700_079])).toBe(1_984_000);
  });

  it("sin meses completos no sugiere nada", () => {
    expect(suggestedIncome([])).toBeNull();
  });
});

it("la clave de lo declarado es una por mes", () => {
  expect(declaredIncomeKey("2026-10")).toBe("declared-income|2026-10");
});
