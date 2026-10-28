import { describe, expect, it } from "vitest";
import * as fx from "./__fixtures__/bancolombia-alerts";
import { parseBancolombiaAlert, parseBancolombiaAlerts } from "./bancolombia-alert";

describe("parseBancolombiaAlert", () => {
  it("lee una compra con débito desde el cuerpo completo del correo", () => {
    expect(parseBancolombiaAlert(fx.cardPurchaseFullEmail)).toEqual({
      ok: true,
      alert: {
        kind: "card_purchase",
        amountCop: 80_000,
        merchant: "ESTACION DE SERVICIO",
        cardType: "debit",
        accountLast4: "1111",
        date: "2026-07-17",
        time: "18:15",
      },
    });
  });

  it("lee una compra desde el snippet de la notificación", () => {
    const result = parseBancolombiaAlert(fx.cardPurchaseSnippet);
    expect(result).toMatchObject({
      ok: true,
      alert: { kind: "card_purchase", amountCop: 10_850, merchant: "TIENDA EJEMPLO CENTRO" },
    });
  });

  it("lee una transferencia a llave con coma de miles y año de 2 dígitos", () => {
    expect(parseBancolombiaAlert(fx.transferOutKeyCommaThousands)).toEqual({
      ok: true,
      alert: {
        kind: "transfer_out_key",
        amountCop: 500_000,
        counterpartyKey: "@andres001",
        counterpartyName: "Andres Prueba Ejemplo",
        accountLast4: "2222",
        date: "2026-07-03",
        time: "18:37",
      },
    });
  });

  it("lee una transferencia a llave numérica sin separador de miles", () => {
    expect(parseBancolombiaAlert(fx.transferOutKeyNoSeparator)).toMatchObject({
      ok: true,
      alert: {
        kind: "transfer_out_key",
        amountCop: 75_000,
        counterpartyKey: "3001234567",
        counterpartyName: "Laura Gómez Pérez",
      },
    });
  });

  it("lee una transferencia a cuenta y guarda solo los últimos 4 dígitos del destino", () => {
    expect(parseBancolombiaAlert(fx.transferOutAccount)).toEqual({
      ok: true,
      alert: {
        kind: "transfer_out_account",
        amountCop: 55_000,
        accountLast4: "2222",
        counterpartyAccountLast4: "8901",
        date: "2026-07-03",
        time: "21:00",
      },
    });
  });

  it("lee una transferencia recibida", () => {
    expect(parseBancolombiaAlert(fx.transferIn)).toEqual({
      ok: true,
      alert: {
        kind: "transfer_in",
        amountCop: 223_200,
        counterpartyName: "JUAN PEREZ RAMIREZ",
        receivingKey: "@ANDRES002",
        accountLast4: "2222",
        date: "2026-10-03",
        time: "18:58",
      },
    });
  });

  it("acepta una transferencia recibida sin hora", () => {
    expect(parseBancolombiaAlert(fx.transferInFromSelfNoTime)).toMatchObject({
      ok: true,
      alert: { kind: "transfer_in", amountCop: 150_000, date: "2026-06-05", time: null },
    });
  });

  it("no reconoce correos del banco que no son alertas de movimientos", () => {
    expect(parseBancolombiaAlert(fx.unrelatedBankEmail)).toEqual({
      ok: false,
      reason: "unrecognized",
    });
  });
});

describe("parseBancolombiaAlerts", () => {
  it("lee varias alertas pegadas juntas, en orden", () => {
    const pasted = [fx.cardPurchaseSnippet, fx.transferOutAccount, fx.unrelatedBankEmail, fx.transferIn].join("\n\n");
    expect(parseBancolombiaAlerts(pasted).map((a) => a.kind)).toEqual([
      "card_purchase",
      "transfer_out_account",
      "transfer_in",
    ]);
  });

  it("devuelve una lista vacía si no hay alertas", () => {
    expect(parseBancolombiaAlerts(fx.unrelatedBankEmail)).toEqual([]);
  });
});
