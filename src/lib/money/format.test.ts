import { describe, expect, it } from "vitest";
import { effectiveRate, formatCop, formatRate, formatUsd } from "./format";

// Intl usa espacios no separables; se normalizan para comparar.
const plain = (s: string) => s.replace(/\s/g, " ");

describe("formato de dinero", () => {
  it("muestra pesos sin decimales", () => {
    expect(plain(formatCop(1_234_567))).toBe("$ 1.234.567");
  });

  it("muestra dólares desde centavos", () => {
    expect(plain(formatUsd(150_050))).toBe("US$ 1.500,50");
  });

  it("muestra la tasa con 2 decimales", () => {
    expect(formatRate(3912.456)).toBe("3.912,46");
  });
});

describe("effectiveRate", () => {
  it("calcula pesos por dólar", () => {
    // 1.000 USD recibidos como 3.850.000 COP
    expect(effectiveRate(3_850_000, 100_000)).toBe(3850);
  });

  it("rechaza un monto en USD de cero", () => {
    expect(() => effectiveRate(1000, 0)).toThrow();
  });
});
