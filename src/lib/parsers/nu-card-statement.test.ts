import { describe, expect, it } from "vitest";
import * as fx from "./__fixtures__/nu-card-statement";
import { parseStatement, type Statement } from "./statement";

function parse(items = fx.buildNuCardStatement()): Statement {
  const result = parseStatement(items);
  if (!result.ok) throw new Error(`No se pudo leer: ${result.problem}`);
  return result.statement;
}

describe("parseStatement (tarjeta de crédito Nu)", () => {
  it("reconoce la tarjeta, el periodo facturado y la primera tarjeta", () => {
    expect(parse()).toMatchObject({ bank: "nu_card", from: "2026-08-29", to: "2026-09-28", accountLast4: "4321" });
  });

  it("registra cada compra por su valor total en la fecha de compra, no por la cuota", () => {
    const { movements } = parse();
    expect(movements.find((m) => m.description.startsWith("Celulares"))).toMatchObject({
      date: "2026-08-20",
      description: "Celulares Ejemplo Pago*Tienda Celulares",
      amountCents: -90_000_000,
    });
  });

  it("el pago entra por su valor completo y los intereses y cargos van a la fecha de corte", () => {
    const { movements } = parse();
    expect(movements.map((m) => [m.date, m.description, m.amountCents])).toEqual([
      ["2026-08-20", "Celulares Ejemplo Pago*Tienda Celulares", -90_000_000],
      ["2026-09-05", "Spotify Pago*Spotify Bogota", -2_690_000],
      ["2026-09-10", "Pago", 65_000_000],
      ["2026-09-28", "Intereses tarjeta Nu", -597_000],
      ["2026-09-28", "Cargos tarjeta Nu", -400_000],
    ]);
  });

  it("no confunde el pago mínimo ni los textos del final con un movimiento", () => {
    expect(parse().movements).toHaveLength(5);
  });

  it("rechaza un resumen que no cuadra", () => {
    const totals = { ...fx.nuCardSummary, minimum: "$36.870,01" };
    expect(parseStatement(fx.buildNuCardStatement({ totals }))).toEqual({ ok: false, problem: "summary_mismatch" });
  });

  it("rechaza una tabla a la que le falta una compra", () => {
    const rows = fx.nuCardRows.filter((r) => r.lines[0] !== "Spotify");
    expect(parseStatement(fx.buildNuCardStatement({ rows }))).toEqual({ ok: false, problem: "totals_mismatch" });
  });

  it("rechaza un pago cuyo desglose no suma su valor", () => {
    const rows = fx.nuCardRows.map((r) => (r.lines[0] === "Pago" ? { ...r, value: "$650.000,01" } : r));
    expect(parseStatement(fx.buildNuCardStatement({ rows }))).toEqual({ ok: false, problem: "totals_mismatch" });
  });

  it("no lee extractos con devoluciones (todavía no se sabe cómo aparecen)", () => {
    const totals = { ...fx.nuCardSummary, refunds: "- $10.000,00", minimum: "$26.870,00", total: "$326.870,00" };
    expect(parseStatement(fx.buildNuCardStatement({ totals }))).toEqual({ ok: false, problem: "unsupported_refunds" });
  });
});
