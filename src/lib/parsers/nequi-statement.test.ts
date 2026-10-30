import { describe, expect, it } from "vitest";
import * as bancolombia from "./__fixtures__/bancolombia-statement";
import * as fx from "./__fixtures__/nequi-statement";
import { parseStatement, type Statement } from "./statement";

function parse(items = fx.buildNequiStatement()): Statement {
  const result = parseStatement(items);
  if (!result.ok) throw new Error(`No se pudo leer: ${result.problem}`);
  return result.statement;
}

describe("parseStatement (Nequi)", () => {
  it("reconoce el banco, el periodo, la cuenta (el celular) y el resumen", () => {
    expect(parse()).toMatchObject({
      bank: "nequi",
      from: "2026-09-01",
      to: "2026-09-30",
      accountLast4: "8877",
      previousBalanceCents: 50_000_000,
      totalCreditsCents: 35_004_567,
      totalDebitsCents: 27_940_000,
      currentBalanceCents: 57_064_567,
    });
  });

  it("ordena los movimientos del más antiguo al más reciente (el PDF los trae al revés)", () => {
    const { movements } = parse();
    expect(movements.map((m) => m.date)).toEqual([...movements.map((m) => m.date)].sort());
    expect(movements[0]).toEqual({
      date: "2026-09-01",
      description: "Recarga desde Bancolombia",
      amountCents: 20_000_000,
      balanceCents: 70_000_000,
    });
  });

  it("lee montos con signo de pesos y negativos ($-12,500.00)", () => {
    expect(parse().movements[2].amountCents).toBe(-1_250_000);
  });

  it("rechaza un extracto de Nequi al que le falta un movimiento", () => {
    const rows = fx.nequiMovements.filter((_, i) => i !== 3);
    expect(parseStatement(fx.buildNequiStatement({ rows }))).toEqual({ ok: false, problem: "totals_mismatch" });
  });

  it("sigue reconociendo los extractos de Bancolombia", () => {
    const result = parseStatement(bancolombia.buildStatement());
    expect(result.ok && result.statement.bank).toBe("bancolombia");
  });
});
