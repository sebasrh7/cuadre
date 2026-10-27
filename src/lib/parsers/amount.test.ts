import { describe, expect, it } from "vitest";
import { centsToPesos, parseCopAmount, parseMinorAmount, parseStatementCents } from "./amount";

describe("parseCopAmount", () => {
  it.each([
    ["$80.000,00", 80_000],
    ["$500,000.00", 500_000],
    ["$75000.00", 75_000],
    ["$55,000", 55_000],
    ["$1.234.567,00", 1_234_567],
    ["$1,234,567", 1_234_567],
    ["$ 19.000,00", 19_000],
    ["$999", 999],
  ])("lee %s como %i pesos", (raw, expected) => {
    expect(parseCopAmount(raw)).toBe(expected);
  });

  it("redondea los centavos al peso más cercano", () => {
    expect(parseCopAmount("$10.850,49")).toBe(10_850);
    expect(parseCopAmount("$10.850,50")).toBe(10_851);
  });

  it.each(["", "$", "abc", "$12a00"])("rechaza %j", (raw) => {
    expect(() => parseCopAmount(raw)).toThrow("Monto no reconocido");
  });
});

describe("parseMinorAmount", () => {
  it.each([
    ["1500", 150_000],
    ["1.500,50", 150_050],
    ["1,500.50", 150_050],
    ["1500.5", 150_050],
    ["0,99", 99],
    ["$ 2,000", 200_000],
  ])("lee %s como %i centavos", (raw, expected) => {
    expect(parseMinorAmount(raw)).toBe(expected);
  });

  it.each(["", "abc", "12,3,4a"])("rechaza %j", (raw) => {
    expect(() => parseMinorAmount(raw)).toThrow("Monto no reconocido");
  });
});

describe("parseStatementCents", () => {
  it.each([
    ["999,999.99", 99_999_999],
    ["-45,900.00", -4_590_000],
    ["1,234,567.89", 123_456_789],
    ["-9,999.99", -999_999],
    ["12.34", 1_234],
    [".45", 45],
    ["-.12", -12],
    ["0.00", 0],
  ])("lee %s como %i centavos", (raw, expected) => {
    expect(parseStatementCents(raw)).toBe(expected);
  });

  it.each(["", "999,99.00", "1.234,56", "$45.00", "45", "45.5", "--1.00"])("rechaza %j", (raw) => {
    expect(() => parseStatementCents(raw)).toThrow("Monto no reconocido");
  });
});

describe("centsToPesos", () => {
  it.each([
    [150, 2],
    [149, 1],
    [-150, -2],
    [45, 0],
    [0, 0],
  ])("%i centavos → %i pesos", (cents, pesos) => {
    expect(centsToPesos(cents)).toBe(pesos);
  });
});
