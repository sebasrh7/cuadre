import { describe, expect, it } from "vitest";
import { parseCopAmount, parseMinorAmount } from "./amount";

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
