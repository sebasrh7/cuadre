import { describe, expect, it } from "vitest";
import { foreignIncomeSchema, onboardingSchema } from "./schemas";

describe("foreignIncomeSchema", () => {
  it("convierte los montos a enteros", () => {
    expect(
      foreignIncomeSchema.parse({
        receivedOn: "2026-10-01",
        amountUsdCents: "1.500,50",
        amountCop: "5.850.000",
        payer: "  Cliente Ejemplo  ",
      }),
    ).toEqual({
      receivedOn: "2026-10-01",
      amountUsdCents: 150_050,
      amountCop: 5_850_000,
      payer: "Cliente Ejemplo",
    });
  });

  it("deja el monto en COP y el pagador opcionales", () => {
    const result = foreignIncomeSchema.parse({
      receivedOn: "2026-10-01",
      amountUsdCents: "1500",
      amountCop: "",
      payer: "",
    });
    expect(result.amountCop).toBeUndefined();
    expect(result.payer).toBeUndefined();
  });

  it.each(["0", "abc", ""])("rechaza un monto en USD %j", (amountUsdCents) => {
    const result = foreignIncomeSchema.safeParse({
      receivedOn: "2026-10-01",
      amountUsdCents,
      amountCop: "",
      payer: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("onboardingSchema", () => {
  const base = {
    workerType: "freelancer",
    arlRisk: "1",
    idLastTwo: "07",
    ownNames: "Andrés Prueba Ejemplo",
    ownKeys: "@andres001, 3001234567\n@andres001",
    savingsLast4: "2222",
    debitCardLast4: "",
    creditCardLast4: "1111",
    privacyAccepted: "on",
  };

  it("separa las listas y quita repetidos", () => {
    const result = onboardingSchema.parse(base);
    expect(result.ownKeys).toEqual(["@andres001", "3001234567"]);
    expect(result.debitCardLast4).toBeUndefined();
  });

  it("exige al menos un nombre propio", () => {
    expect(onboardingSchema.safeParse({ ...base, ownNames: " , " }).success).toBe(false);
  });

  it("lee los dos últimos dígitos del documento, con cero inicial", () => {
    expect(onboardingSchema.parse(base).idLastTwo).toBe(7);
    expect(onboardingSchema.safeParse({ ...base, idLastTwo: "7" }).success).toBe(false);
  });

  it("exige aceptar la política de datos", () => {
    expect(onboardingSchema.safeParse({ ...base, privacyAccepted: undefined }).success).toBe(false);
  });

  it("deja la IA apagada si no se marca", () => {
    expect(onboardingSchema.parse(base).aiCategorization).toBe(false);
    expect(onboardingSchema.parse({ ...base, aiCategorization: "on" }).aiCategorization).toBe(true);
  });

  it("rechaza números de cuenta completos", () => {
    expect(onboardingSchema.safeParse({ ...base, savingsLast4: "12345678901" }).success).toBe(false);
  });
});
