import { describe, expect, it } from "vitest";
import * as fx from "./__fixtures__/nu-account-statement";
import { parseStatement, type Statement } from "./statement";

function parse(items = fx.buildNuAccountStatement()): Statement {
  const result = parseStatement(items);
  if (!result.ok) throw new Error(`No se pudo leer: ${result.problem}`);
  return result.statement;
}

describe("parseStatement (Cuenta Nu)", () => {
  it("reconoce el banco, el periodo, la cuenta y el resumen (con 4x1000 y rendimientos)", () => {
    expect(parse()).toMatchObject({
      bank: "nu",
      from: "2026-09-01",
      to: "2026-09-30",
      accountLast4: "5678",
      previousBalanceCents: 100_000_000,
      totalCreditsCents: 60_123_456,
      totalDebitsCents: 35_140_000,
      currentBalanceCents: 124_983_456,
    });
  });

  it("lee montos en formato colombiano con signo", () => {
    const { movements } = parse();
    expect(movements[0]).toEqual({
      date: "2026-09-02",
      description: "Recibiste de ANA PRUEBA",
      amountCents: 40_000_000,
      balanceCents: 140_000_000,
    });
    expect(movements[2].amountCents).toBe(-20_000);
  });

  it("el 4x1000 hereda la fecha de su movimiento y los rendimientos van al cierre", () => {
    const { movements } = parse();
    expect(movements.map((m) => m.date)).toEqual([
      "2026-09-02",
      "2026-09-05",
      "2026-09-05",
      "2026-09-10",
      "2026-09-15",
      "2026-09-15",
      "2026-09-30",
    ]);
  });

  it("ignora los renglones de texto sin monto", () => {
    expect(parse().movements).toHaveLength(7);
  });

  it("rechaza un extracto al que le falta un movimiento", () => {
    const rows = fx.nuMovements.filter((_, i) => i !== 1);
    expect(parseStatement(fx.buildNuAccountStatement({ rows }))).toEqual({ ok: false, problem: "totals_mismatch" });
  });

  it("rechaza un resumen que no cuadra", () => {
    const totals = { ...fx.nuSummary, end: "$1.249.834,55" };
    expect(parseStatement(fx.buildNuAccountStatement({ totals }))).toEqual({ ok: false, problem: "summary_mismatch" });
  });
});
