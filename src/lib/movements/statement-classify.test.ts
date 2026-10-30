import { describe, expect, it } from "vitest";
import * as fx from "@/lib/parsers/__fixtures__/bancolombia-statement";
import { parseBancolombiaStatement, type StatementMovement } from "@/lib/parsers/statement";
import { classifyStatementMovement, groupMonthlyInterest } from "./statement-classify";

const movement = (description: string, amountCents: number): StatementMovement => ({
  date: "2026-12-01",
  description,
  amountCents,
  balanceCents: 0,
});

describe("classifyStatementMovement", () => {
  it.each([
    ["ABONO DE GIRO INTERNACIONAL", 385_000_000, "foreign_income", "Giro internacional"],
    ["ABONO INTERESES AHORROS", 45, "interest", null],
    ["AJUSTE INTERES AHORROS DB", -12, "interest", null],
    ["TRANSFERENCIAS A NEQUI", -20_000_000, "wallet_transfer", "Nequi"],
    ["TRANSFERENCIA A NEQUI", -20_000_000, "wallet_transfer", "Nequi"],
    ["TRANSF A ANDRES PRUEBA EJEMPLO", -50_000_000, "person_transfer", "ANDRES PRUEBA EJEMPLO"],
    ["COMPRA EN TIENDA EJEMPLO", -4_590_000, "expense", "TIENDA EJEMPLO"],
    ["PAGO QR CAFE EJEMPLO", -1_250_000, "expense", "CAFE EJEMPLO"],
    ["PAGO PSE EMPRESA EJEMPLO", -8_000_000, "expense", "EMPRESA EJEMPLO"],
    ["COBRO SUSCR STREAMING", -2_000_000, "expense", "STREAMING"],
    ["RETIRO CAJERO CENTRO", -10_000_000, "expense", "Retiro en cajero"],
    ["ABONO POR DEVOLUCION", 500_000, "other_income", "ABONO POR DEVOLUCION"],
  ])("%s → %s", (description, amount, kind, counterparty) => {
    expect(classifyStatementMovement(movement(description, amount))).toEqual({ kind, counterparty });
  });
});

describe("groupMonthlyInterest", () => {
  it("suma los intereses por mes en centavos y redondea al final", () => {
    const result = parseBancolombiaStatement(fx.buildStatement());
    if (!result.ok) throw new Error(result.problem);
    expect(groupMonthlyInterest(result.statement.movements)).toEqual([
      { month: "2026-12", lastDate: "2026-12-01", pesos: 0 },
      // 1,20 − 0,12 = 1,08 → 1 peso
      { month: "2027-01", lastDate: "2027-01-04", pesos: 1 },
    ]);
  });

  it("no pierde plata por redondear cada abono por separado", () => {
    // 10 abonos de 0,45: redondeados uno por uno darían 0; sumados dan 4,50 → 5.
    const daily = Array.from({ length: 10 }, (_, i) => ({
      ...movement("ABONO INTERESES AHORROS", 45),
      date: `2026-12-${String(i + 1).padStart(2, "0")}`,
    }));
    expect(groupMonthlyInterest(daily)).toEqual([{ month: "2026-12", lastDate: "2026-12-10", pesos: 5 }]);
  });
});

describe("classifyStatementMovement (Nequi)", () => {
  it.each([
    ["Recarga desde Bancolombia", 20_000_000, "self_transfer", "Bancolombia"],
    ["Pago de Intereses", 4_567, "interest", null],
    ["De ANA PRUEBA", 15_000_000, "person_transfer", "ANA PRUEBA"],
    ["Para ANDRES PRUEBA EJEMPLO", -10_000_000, "person_transfer", "ANDRES PRUEBA EJEMPLO"],
    ["ENVIO CON BRE-B A: LAURA EJEMPLO", -8_000_000, "person_transfer", "LAURA EJEMPLO"],
    ["PAGO EN QR BRE-B: PANADERIA EJEMPLO", -1_250_000, "expense", "PANADERIA EJEMPLO"],
    ["COMPRA PIN PTM NETFLIX", -2_690_000, "expense", "NETFLIX"],
    ["Pago en TIGO FACTURAS EE", -6_000_000, "expense", "TIGO FACTURAS EE"],
    ["Pago PTM Acueducto Ejemplo SA", -5_000_000, "expense", "Acueducto Ejemplo SA"],
    ["CLARO", -4_000_000, "expense", "CLARO"],
  ])("%s → %s", (description, amount, kind, counterparty) => {
    expect(classifyStatementMovement(movement(description, amount), "nequi")).toEqual({ kind, counterparty });
  });
});

describe("classifyStatementMovement (Cuenta Nu)", () => {
  it.each([
    ["Recibiste de ANA PRUEBA", 40_000_000, "person_transfer", "ANA PRUEBA"],
    ["Pagaste tu tarjeta", -30_000_000, "self_transfer", "Tarjeta Nu"],
    ["Compra en FERRETERIA EJEMPLO con tarjeta débito", -5_000_000, "expense", "FERRETERIA EJEMPLO"],
    ["Impuesto del 4x1000", -20_000, "expense", "Impuesto 4x1000"],
    ["Rendimiento total de tu cuenta", 123_456, "interest", null],
    ["Cobro por retiro", -1_000_000, "expense", "Cobro por retiro"],
  ])("%s → %s", (description, amount, kind, counterparty) => {
    expect(classifyStatementMovement(movement(description, amount), "nu")).toEqual({ kind, counterparty });
  });
});

describe("classifyStatementMovement (tarjeta de crédito Nu)", () => {
  it.each([
    ["Pago", 65_000_000, "self_transfer", "Pago tarjeta Nu"],
    ["Spotify Pago*Spotify Bogota", -2_690_000, "expense", "Spotify"],
    ["Pago*Tienda Celulares", -90_000_000, "expense", "Tienda Celulares"],
    ["Intereses tarjeta Nu", -597_000, "expense", "Intereses tarjeta Nu"],
  ])("%s → %s", (description, amount, kind, counterparty) => {
    expect(classifyStatementMovement(movement(description, amount), "nu_card")).toEqual({ kind, counterparty });
  });
});
