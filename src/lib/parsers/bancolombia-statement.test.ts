import { describe, expect, it } from "vitest";
import * as fx from "./__fixtures__/bancolombia-statement";
import { parseBancolombiaStatement, type Statement } from "./bancolombia-statement";

function parse(items = fx.buildStatement()): Statement {
  const result = parseBancolombiaStatement(items);
  if (!result.ok) throw new Error(`No se pudo leer: ${result.problem}`);
  return result.statement;
}

describe("parseBancolombiaStatement", () => {
  it("lee el periodo, la cuenta y el resumen", () => {
    expect(parse()).toMatchObject({
      from: "2026-11-30",
      to: "2027-01-31",
      accountLast4: "8901",
      previousBalanceCents: 100_000_000,
      totalCreditsCents: 385_000_165,
      totalDebitsCents: 75_840_012,
      currentBalanceCents: 409_160_153,
    });
  });

  it("lee todos los movimientos de todas las páginas, en orden", () => {
    const { movements } = parse();
    expect(movements).toHaveLength(8);
    expect(movements[1]).toEqual({
      date: "2026-12-03",
      description: "ABONO DE GIRO INTERNACIONAL",
      amountCents: 385_000_000,
      balanceCents: 485_000_045,
    });
  });

  it("une la descripción partida en varios fragmentos", () => {
    expect(parse().movements[4].description).toBe("TRANSFERENCIAS A NEQUI");
  });

  it("repara la ñ que la fuente del extracto dibuja como |", () => {
    const rows = fx.movements.map((m, i) =>
      i === 3 ? { ...m, description: [[79, "TRANSF A Ana"], [170, "Mu|oz"]] as fx.FixtureMovement["description"] } : m,
    );
    expect(parse(fx.buildStatement({ rows })).movements[3].description).toBe("TRANSF A Ana Muñoz");
    const upper = fx.movements.map((m, i) =>
      i === 3 ? { ...m, description: [[79, "TRANSF A MARIA"], [170, "MU|OZ"]] as fx.FixtureMovement["description"] } : m,
    );
    expect(parse(fx.buildStatement({ rows: upper })).movements[3].description).toBe("TRANSF A MARIA MUÑOZ");
  });

  it("asigna el año siguiente a los meses de enero de un periodo que cruza de año", () => {
    const dates = parse().movements.map((m) => m.date);
    expect(dates[4]).toBe("2026-12-20");
    expect(dates[5]).toBe("2027-01-02");
  });

  it("lee montos sin cero inicial y con signo", () => {
    const { movements } = parse();
    expect(movements[0].amountCents).toBe(45);
    expect(movements[6].amountCents).toBe(-12);
  });

  it("ignora renglones que no son movimientos (encabezados, pie, fin del extracto)", () => {
    expect(parse().movements.every((m) => /^\d{4}-\d{2}-\d{2}$/.test(m.date))).toBe(true);
  });

  it("rechaza un extracto al que le falta un movimiento", () => {
    const rows = fx.movements.filter((_, i) => i !== 2);
    expect(parseBancolombiaStatement(fx.buildStatement({ rows }))).toEqual({
      ok: false,
      problem: "totals_mismatch",
    });
  });

  it("rechaza un resumen que no cuadra consigo mismo", () => {
    const totals = { ...fx.summary, current: "9,999,999.99" };
    expect(parseBancolombiaStatement(fx.buildStatement({ totals }))).toEqual({
      ok: false,
      problem: "summary_mismatch",
    });
  });

  it("rechaza movimientos leídos en desorden (los saldos no encadenan)", () => {
    const rows = [...fx.movements];
    [rows[2], rows[3]] = [rows[3], rows[2]];
    expect(parseBancolombiaStatement(fx.buildStatement({ rows }))).toEqual({
      ok: false,
      problem: "balance_mismatch",
    });
  });

  it("rechaza un PDF que no es un extracto", () => {
    expect(
      parseBancolombiaStatement([{ page: 1, x: 10, y: 700, str: "Factura de venta" }]),
    ).toEqual({ ok: false, problem: "not_a_statement" });
  });
});
