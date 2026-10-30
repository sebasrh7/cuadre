import { describe, expect, it } from "vitest";
import * as fx from "@/lib/parsers/__fixtures__/bancolombia-alerts";
import { parseBancolombiaAlerts } from "@/lib/parsers/bancolombia-alert";
import { matchAlertsToStatement, planAlertImport, type MatchableMovement } from "./alert-import";
import type { OwnIdentity } from "./own-transfer";

const own: OwnIdentity = { names: ["Andrés Prueba Ejemplo"], keys: ["@andres001"], accountsLast4: ["8901"] };
const alerts = parseBancolombiaAlerts(
  [fx.cardPurchaseSnippet, fx.transferOutKeyCommaThousands, fx.transferOutKeyNoSeparator, fx.transferOutAccount, fx.transferIn].join("\n"),
);

describe("planAlertImport", () => {
  const plan = planAlertImport(alerts, own);

  it("convierte una compra en gasto sin categoría (la ponen las reglas o la IA)", () => {
    expect(plan[0]).toMatchObject({
      occurredOn: "2026-10-16",
      occurredAtTime: "20:17",
      amountCop: 10_850,
      direction: "out",
      kind: "expense",
      counterparty: "TIENDA EJEMPLO CENTRO",
      category: null,
      accountLast4: "1111",
    });
  });

  it("marca como propias las transferencias a llaves y cuentas propias", () => {
    expect(plan[1].kind).toBe("own_transfer");
    expect(plan[3]).toMatchObject({ kind: "own_transfer", counterparty: "Cuenta *8901" });
  });

  it("categoriza los pagos a terceros como Transferencias sin pasar por la IA", () => {
    expect(plan[2]).toMatchObject({ kind: "expense", category: "Transferencias", counterparty: "Laura Gómez Pérez" });
  });

  it("lo recibido de un tercero queda sin clasificar: no se sabe si es ingreso", () => {
    expect(plan[4]).toMatchObject({ kind: "received", direction: "in", counterparty: "JUAN PEREZ RAMIREZ", category: null });
  });

  it("la misma alerta pegada dos veces tiene la misma clave", () => {
    const twice = planAlertImport(parseBancolombiaAlerts(fx.cardPurchaseSnippet), own);
    expect(twice[0].dedupeKey).toBe(plan[0].dedupeKey);
  });
});

describe("matchAlertsToStatement", () => {
  const m = (id: string, occurredOn: string, amountCop: number, direction: "in" | "out" = "out"): MatchableMovement => ({
    id,
    occurredOn,
    amountCop,
    direction,
  });

  it("empareja por monto, sentido y fecha", () => {
    expect(matchAlertsToStatement([m("a1", "2026-10-16", 10_850)], [m("s1", "2026-10-16", 10_850)])).toEqual([
      { alertId: "a1", statementId: "s1" },
    ]);
  });

  it("acepta un día de diferencia, pero prefiere la fecha exacta", () => {
    const pairs = matchAlertsToStatement(
      [m("a1", "2026-10-16", 10_000), m("a2", "2026-10-17", 10_000)],
      [m("s1", "2026-10-17", 10_000), m("s2", "2026-10-15", 10_000)],
    );
    expect(pairs).toEqual([
      { alertId: "a2", statementId: "s1" },
      { alertId: "a1", statementId: "s2" },
    ]);
  });

  it("no empareja montos distintos, sentidos distintos ni fechas lejanas", () => {
    expect(
      matchAlertsToStatement(
        [m("a1", "2026-10-16", 10_850), m("a2", "2026-10-16", 5_000, "in"), m("a3", "2026-10-16", 7_000)],
        [m("s1", "2026-10-16", 10_851), m("s2", "2026-10-16", 5_000, "out"), m("s3", "2026-10-19", 7_000)],
      ),
    ).toEqual([]);
  });

  it("no usa el mismo movimiento del extracto para dos alertas", () => {
    expect(
      matchAlertsToStatement([m("a1", "2026-10-16", 1_000), m("a2", "2026-10-16", 1_000)], [m("s1", "2026-10-16", 1_000)]),
    ).toHaveLength(1);
  });
});
