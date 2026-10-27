import { describe, expect, it } from "vitest";
import * as fx from "@/lib/parsers/__fixtures__/bancolombia-alerts";
import { parseBancolombiaAlert, type BancolombiaAlert } from "@/lib/parsers/bancolombia-alert";
import { isOwnTransfer, type OwnIdentity } from "./own-transfer";

const own: OwnIdentity = {
  names: ["Andrés Prueba Ejemplo"],
  keys: ["@andres001", "@andres002"],
  accountsLast4: ["8901"],
};

function parse(text: string): BancolombiaAlert {
  const result = parseBancolombiaAlert(text);
  if (!result.ok) throw new Error("La alerta de prueba no se pudo leer");
  return result.alert;
}

describe("isOwnTransfer", () => {
  it("detecta una transferencia enviada a una llave propia", () => {
    expect(isOwnTransfer(parse(fx.transferOutKeyCommaThousands), own)).toBe(true);
  });

  it("detecta una transferencia a una cuenta propia por sus últimos 4 dígitos", () => {
    expect(isOwnTransfer(parse(fx.transferOutAccount), own)).toBe(true);
  });

  it("compara llaves sin importar mayúsculas", () => {
    const alert = parse(fx.transferOutKeyCommaThousands);
    expect(isOwnTransfer(alert, { ...own, names: [], keys: ["@ANDRES001"] })).toBe(true);
  });

  it("una transferencia recibida de un tercero no es propia aunque llegue a una llave propia", () => {
    expect(isOwnTransfer(parse(fx.transferIn), own)).toBe(false);
  });

  it("compara nombres sin importar tildes ni mayúsculas", () => {
    expect(isOwnTransfer(parse(fx.transferInFromSelfNoTime), own)).toBe(true);
  });

  it("no marca como propia una transferencia a un tercero", () => {
    expect(isOwnTransfer(parse(fx.transferOutKeyNoSeparator), own)).toBe(false);
  });

  it("una compra nunca es transferencia propia", () => {
    expect(isOwnTransfer(parse(fx.cardPurchaseSnippet), own)).toBe(false);
  });
});
