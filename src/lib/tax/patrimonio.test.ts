import { describe, expect, it } from "vitest";
import { patrimonioTotal } from "./patrimonio";

describe("patrimonioTotal", () => {
  it("suma los saldos de las cuentas y los bienes", () => {
    const accounts = [
      { kind: "savings", balanceCop: 1_200_000 },
      { kind: "wallet", balanceCop: 300_000 },
    ];
    expect(patrimonioTotal(accounts, [{ valueCop: 40_000_000 }])).toBe(41_500_000);
  });

  it("la tarjeta de crédito no suma: es deuda, y las deudas no restan del patrimonio bruto", () => {
    expect(patrimonioTotal([{ kind: "credit_card", balanceCop: 900_000 }, { kind: "savings", balanceCop: 100 }], [])).toBe(100);
  });

  it("una cuenta sin saldo conocido no cuenta como $0", () => {
    expect(patrimonioTotal([{ kind: "savings", balanceCop: null }], [{ valueCop: 5_000_000 }])).toBe(5_000_000);
  });

  it("sin saldos ni bienes no hay dato", () => {
    expect(patrimonioTotal([{ kind: "savings", balanceCop: null }], [])).toBeNull();
  });
});
