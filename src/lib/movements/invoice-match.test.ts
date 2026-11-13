import { describe, expect, it } from "vitest";
import { matchInvoicesToExpenses } from "./invoice-match";

const invoice = (id: string, issuedOn: string, totalCop: number) => ({ id, issuedOn, totalCop });
const expense = (id: string, occurredOn: string, amountCop: number) => ({ id, occurredOn, amountCop });

describe("matchInvoicesToExpenses", () => {
  it("enlaza la factura con el gasto del mismo valor y el mismo día", () => {
    expect(
      matchInvoicesToExpenses([invoice("f1", "2026-12-05", 45_900)], [expense("m1", "2026-12-05", 45_900)]),
    ).toEqual([{ invoiceId: "f1", movementId: "m1" }]);
  });

  it("no enlaza si el valor difiere, así sea por un peso", () => {
    expect(matchInvoicesToExpenses([invoice("f1", "2026-12-05", 45_900)], [expense("m1", "2026-12-05", 45_901)])).toEqual([]);
  });

  it("acepta el pago hasta 3 días antes y hasta 30 días después de la factura", () => {
    const f = [invoice("f1", "2026-12-05", 80_000)];
    expect(matchInvoicesToExpenses(f, [expense("m1", "2026-12-02", 80_000)])).toHaveLength(1);
    expect(matchInvoicesToExpenses(f, [expense("m1", "2026-12-01", 80_000)])).toHaveLength(0);
    expect(matchInvoicesToExpenses(f, [expense("m1", "2027-01-04", 80_000)])).toHaveLength(1);
    expect(matchInvoicesToExpenses(f, [expense("m1", "2027-01-05", 80_000)])).toHaveLength(0);
  });

  it("entre varios gastos iguales elige el de fecha más cercana", () => {
    expect(
      matchInvoicesToExpenses(
        [invoice("f1", "2026-12-05", 20_000)],
        [expense("lejos", "2026-12-20", 20_000), expense("cerca", "2026-12-06", 20_000)],
      ),
    ).toEqual([{ invoiceId: "f1", movementId: "cerca" }]);
  });

  it("dos facturas iguales (la mensualidad de dos meses) van cada una a su pago", () => {
    const pairs = matchInvoicesToExpenses(
      [invoice("nov", "2026-11-10", 60_000), invoice("dic", "2026-12-10", 60_000)],
      [expense("pago-dic", "2026-12-15", 60_000), expense("pago-nov", "2026-11-15", 60_000)],
    );
    expect(pairs).toHaveLength(2);
    expect(pairs).toContainEqual({ invoiceId: "nov", movementId: "pago-nov" });
    expect(pairs).toContainEqual({ invoiceId: "dic", movementId: "pago-dic" });
  });

  it("un gasto no soporta dos facturas", () => {
    expect(
      matchInvoicesToExpenses(
        [invoice("f1", "2026-12-05", 10_000), invoice("f2", "2026-12-05", 10_000)],
        [expense("m1", "2026-12-05", 10_000)],
      ),
    ).toEqual([{ invoiceId: "f1", movementId: "m1" }]);
  });

  it("sin facturas o sin gastos no hay parejas", () => {
    expect(matchInvoicesToExpenses([], [expense("m1", "2026-12-05", 1)])).toEqual([]);
    expect(matchInvoicesToExpenses([invoice("f1", "2026-12-05", 1)], [])).toEqual([]);
  });
});
