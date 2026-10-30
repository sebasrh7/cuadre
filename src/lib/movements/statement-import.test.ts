import { describe, expect, it } from "vitest";
import * as fx from "@/lib/parsers/__fixtures__/bancolombia-statement";
import * as nequiFx from "@/lib/parsers/__fixtures__/nequi-statement";
import * as nuFx from "@/lib/parsers/__fixtures__/nu-account-statement";
import * as nuCardFx from "@/lib/parsers/__fixtures__/nu-card-statement";
import { parseBancolombiaStatement, parseStatement, type Statement } from "@/lib/parsers/statement";
import {
  planStatementImport,
  reconcileForeignIncomes,
  type ImportDecisions,
  type PendingForeignIncome,
  type StatementGiro,
} from "./statement-import";

function statement(rows = fx.movements): Statement {
  const result = parseBancolombiaStatement(fx.buildStatement({ rows }));
  if (!result.ok) throw new Error(result.problem);
  return result.statement;
}

const decisions: ImportDecisions = { nequiIsOwn: true, ownPersonNames: ["Andrés Prueba Ejemplo"] };

describe("planStatementImport", () => {
  const plan = planStatementImport(statement(), decisions);

  it("convierte cada movimiento a pesos con su tipo", () => {
    expect(plan.find((m) => m.counterparty === "TIENDA EJEMPLO")).toMatchObject({
      occurredOn: "2026-12-05",
      amountCop: 45_900,
      direction: "out",
      kind: "expense",
      accountLast4: "8901",
    });
  });

  it("marca el giro internacional como ingreso del exterior", () => {
    expect(plan.find((m) => m.category === "Ingreso del exterior")).toMatchObject({
      amountCop: 3_850_000,
      direction: "in",
      kind: "income",
    });
  });

  it("marca como propias las transferencias a Nequi y a nombres propios (sin importar tildes)", () => {
    const own = plan.filter((m) => m.kind === "own_transfer").map((m) => m.counterparty);
    expect(own).toEqual(["ANDRES PRUEBA EJEMPLO", "Nequi"]);
  });

  it("categoriza las transferencias a terceros sin pasar por la IA y deja los gastos para después", () => {
    const thirdParty = planStatementImport(statement(), { nequiIsOwn: false, ownPersonNames: [] });
    expect(thirdParty.find((m) => m.counterparty === "ANDRES PRUEBA EJEMPLO")?.category).toBe("Transferencias");
    expect(thirdParty.find((m) => m.counterparty === "Nequi")?.category).toBe("Transferencias");
    expect(thirdParty.find((m) => m.counterparty === "TIENDA EJEMPLO")?.category).toBeNull();
    expect(plan.find((m) => m.kind === "own_transfer")?.category).toBeNull();
  });

  it("respeta cuando el usuario dice que Nequi no es suyo", () => {
    const nequi = planStatementImport(statement(), { ...decisions, nequiIsOwn: false }).find(
      (m) => m.counterparty === "Nequi",
    );
    expect(nequi?.kind).toBe("expense");
  });

  it("agrupa los intereses en un movimiento por mes y omite los meses que suman 0", () => {
    const interest = plan.filter((m) => m.category === "Intereses");
    expect(interest).toEqual([
      expect.objectContaining({ occurredOn: "2027-01-04", amountCop: 1, dedupeKey: "statement-interest|8901|2027-01" }),
    ]);
  });

  it("da claves distintas a dos movimientos idénticos del mismo día", () => {
    const twice = [...fx.movements.slice(0, 3), { ...fx.movements[2], balance: "4,758,200.45" }];
    const totals = { previous: "1,000,000.00", credits: "3,850,000.45", debits: "91,800.00", current: "4,758,200.45" };
    const result = parseBancolombiaStatement(fx.buildStatement({ rows: twice, totals }));
    if (!result.ok) throw new Error(result.problem);
    const keys = planStatementImport(result.statement, decisions)
      .filter((m) => m.counterparty === "TIENDA EJEMPLO")
      .map((m) => m.dedupeKey);
    expect(new Set(keys).size).toBe(2);
  });

  it("produce las mismas claves si se importa dos veces", () => {
    const again = planStatementImport(statement(), decisions);
    expect(again.map((m) => m.dedupeKey)).toEqual(plan.map((m) => m.dedupeKey));
  });
});

describe("reconcileForeignIncomes", () => {
  const giros: StatementGiro[] = [
    { movementId: "g1", occurredOn: "2026-12-03", amountCop: 3_850_000 },
    { movementId: "g2", occurredOn: "2026-12-17", amountCop: 3_900_000 },
  ];
  const income = (id: string, receivedOn: string, manualCop?: number): PendingForeignIncome => ({
    id,
    receivedOn,
    manualMovement: manualCop ? { id: `manual-${id}`, amountCop: manualCop } : null,
  });

  it("enlaza por monto exacto y reemplaza el abono manual", () => {
    expect(reconcileForeignIncomes(giros, [income("i1", "2026-12-02", 3_900_000)])).toEqual([]);
    expect(reconcileForeignIncomes(giros, [income("i1", "2026-12-15", 3_900_000)])).toEqual([
      { incomeId: "i1", movementId: "g2", replacesManualMovementId: "manual-i1" },
    ]);
  });

  it("sin abono en COP, enlaza con el giro más cercano en fecha", () => {
    expect(reconcileForeignIncomes(giros, [income("i1", "2026-12-04")])).toEqual([
      { incomeId: "i1", movementId: "g1", replacesManualMovementId: null },
    ]);
  });

  it("no enlaza si el giro está a más de 5 días", () => {
    expect(reconcileForeignIncomes(giros, [income("i1", "2026-12-10")])).toEqual([]);
  });

  it("no adivina ante un empate", () => {
    const tie: StatementGiro[] = [
      { movementId: "a", occurredOn: "2026-12-01", amountCop: 1 },
      { movementId: "b", occurredOn: "2026-12-05", amountCop: 2 },
    ];
    expect(reconcileForeignIncomes(tie, [income("i1", "2026-12-03")])).toEqual([]);
  });

  it("no usa el mismo giro para dos ingresos y prioriza el que tiene monto", () => {
    const links = reconcileForeignIncomes(
      [giros[0]],
      [income("sin-monto", "2026-12-03"), income("con-monto", "2026-12-05", 3_850_000)],
    );
    expect(links).toEqual([{ incomeId: "con-monto", movementId: "g1", replacesManualMovementId: "manual-con-monto" }]);
  });
});

describe("planStatementImport (Nequi)", () => {
  const result = parseStatement(nequiFx.buildNequiStatement());
  if (!result.ok) throw new Error(result.problem);
  const plan = planStatementImport(result.statement, decisions);

  it("la recarga desde Bancolombia siempre es entre cuentas propias", () => {
    expect(plan.find((m) => m.counterparty === "Bancolombia")).toMatchObject({ kind: "own_transfer", category: null });
  });

  it("lo recibido de otra persona es ingreso, sin categoría de transferencia", () => {
    expect(plan.find((m) => m.counterparty === "ANA PRUEBA")).toMatchObject({ kind: "income", category: null });
  });

  it("lo enviado a otra persona es gasto en Transferencias, y a sí mismo es propio", () => {
    expect(plan.find((m) => m.counterparty === "LAURA EJEMPLO")).toMatchObject({ kind: "expense", category: "Transferencias" });
    expect(plan.find((m) => m.counterparty === "ANDRES PRUEBA EJEMPLO")?.kind).toBe("own_transfer");
  });

  it("agrupa los intereses y usa claves distintas a las de Bancolombia", () => {
    expect(plan.find((m) => m.category === "Intereses")).toMatchObject({
      amountCop: 46,
      dedupeKey: "statement-interest|nequi|8877|2026-09",
    });
    expect(plan.every((m) => m.dedupeKey.includes("nequi|"))).toBe(true);
  });
});

describe("planStatementImport (Cuenta Nu)", () => {
  const result = parseStatement(nuFx.buildNuAccountStatement());
  if (!result.ok) throw new Error(result.problem);
  const plan = planStatementImport(result.statement, decisions);

  it("el pago de la tarjeta Nu es entre cuentas propias", () => {
    expect(plan.find((m) => m.counterparty === "Tarjeta Nu")).toMatchObject({ kind: "own_transfer", category: null });
  });

  it("guarda cada 4x1000 como gasto, aunque se repita el mismo día", () => {
    expect(plan.filter((m) => m.counterparty === "Impuesto 4x1000")).toHaveLength(2);
  });

  it("los rendimientos son intereses con claves propias de Nu", () => {
    expect(plan.find((m) => m.category === "Intereses")).toMatchObject({
      amountCop: 1235,
      dedupeKey: "statement-interest|nu|5678|2026-09",
    });
    expect(plan.every((m) => m.dedupeKey.includes("nu|"))).toBe(true);
    expect(plan).toHaveLength(7);
  });
});

describe("planStatementImport (tarjeta de crédito Nu)", () => {
  const result = parseStatement(nuCardFx.buildNuCardStatement());
  if (!result.ok) throw new Error(result.problem);
  const plan = planStatementImport(result.statement, decisions);

  it("el pago de la tarjeta es entre cuentas propias: no es ingreso", () => {
    expect(plan.find((m) => m.counterparty === "Pago tarjeta Nu")).toMatchObject({ kind: "own_transfer", direction: "in" });
  });

  it("las compras y los intereses son gastos", () => {
    expect(plan.filter((m) => m.kind === "expense").map((m) => [m.counterparty, m.amountCop])).toEqual([
      ["Tienda Celulares", 900_000],
      ["Spotify Bogota", 26_900],
      ["Intereses tarjeta Nu", 5970],
      ["Cargos tarjeta Nu", 4000],
    ]);
  });

  it("la clave de una compra a cuotas no depende del extracto en que aparece", () => {
    const key = plan.find((m) => m.counterparty === "Tienda Celulares")?.dedupeKey;
    expect(key).toBe("statement|nu_card|4321|2026-08-20|-90000000|Celulares Ejemplo Pago*Tienda Celulares|0");
  });
});
