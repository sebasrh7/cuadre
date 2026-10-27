import { describe, expect, it } from "vitest";
import { rules2026Rows } from "./__fixtures__/rules-2026";
import { checkRenta, unmeasuredRentaThresholds } from "./renta";
import { buildTaxRules } from "./rules";
import { estimateSocialSecurity } from "./social-security";

const rules = buildTaxRules(rules2026Rows);

describe("buildTaxRules", () => {
  it("convierte porcentajes a partes por 100.000", () => {
    expect(rules.socialSecurity.healthPer100k).toBe(12_500);
    expect(rules.socialSecurity.arlPer100k[0]).toBe(522);
  });

  it("falla si falta una regla en lugar de usar un valor inventado", () => {
    expect(() => buildTaxRules(rules2026Rows.filter((r) => r.key !== "smmlv"))).toThrow("smmlv");
  });
});

describe("estimateSocialSecurity", () => {
  it("cotiza sobre 1 SMMLV cuando el 40 % queda por debajo (ejemplo de la UGPP)", () => {
    // 40 % de 2.000.000 = 800.000 < 1.750.905
    expect(estimateSocialSecurity(2_000_000, 1, rules)).toEqual({
      obligated: true,
      ibcRaw: 800_000,
      ibc: 1_750_905,
      ibcAtFloor: true,
      health: 218_863, // 12,5 %
      pension: 280_145, // 16 %
      arl: 9_140, // 0,522 %
      total: 508_148,
    });
  });

  it("usa el 40 % del ingreso cuando supera el mínimo (ejemplo de la UGPP: 5.000.000)", () => {
    const estimate = estimateSocialSecurity(5_000_000, 1, rules);
    expect(estimate.ibc).toBe(2_000_000);
    expect(estimate.health).toBe(250_000);
    expect(estimate.pension).toBe(320_000);
    expect(estimate.arl).toBe(10_440);
  });

  it("no exige aportes con ingresos menores a 1 SMMLV", () => {
    expect(estimateSocialSecurity(1_000_000, 1, rules).obligated).toBe(false);
  });

  it("limita el IBC a 25 SMMLV", () => {
    expect(estimateSocialSecurity(1_000_000_000, 1, rules).ibc).toBe(25 * 1_750_905);
  });

  it("aplica la tarifa ARL del nivel de riesgo", () => {
    expect(estimateSocialSecurity(5_000_000, 3, rules).arl).toBe(48_720); // 2,436 %
  });
});

describe("checkRenta", () => {
  // 1.400 UVT × 52.374 = 73.323.600
  it("calcula el tope en pesos con la UVT del año", () => {
    const [ingresos] = checkRenta({ incomeYtd: 0, depositsYtd: 0, monthsWithData: 0 }, rules);
    expect(ingresos.threshold).toBe(73_323_600);
  });

  it("proyecta el año con el promedio de los meses con datos", () => {
    const [ingresos] = checkRenta({ incomeYtd: 6_000_000, depositsYtd: 6_000_000, monthsWithData: 3 }, rules);
    expect(ingresos.projected).toBe(24_000_000);
    expect(ingresos.status).toBe("far");
  });

  it("avisa cuando la proyección pasa el tope aunque todavía no lo haya pasado", () => {
    const [ingresos] = checkRenta({ incomeYtd: 20_000_000, depositsYtd: 20_000_000, monthsWithData: 3 }, rules);
    expect(ingresos.status).toBe("likely");
  });

  it("marca cerca cuando la proyección llega al 80 % del tope", () => {
    const [ingresos] = checkRenta({ incomeYtd: 15_000_000, depositsYtd: 15_000_000, monthsWithData: 3 }, rules);
    expect(ingresos.projected).toBe(60_000_000);
    expect(ingresos.status).toBe("close");
  });

  it("evalúa las consignaciones por separado: las transferencias propias también cuentan", () => {
    const [ingresos, consignaciones] = checkRenta(
      { incomeYtd: 30_000_000, depositsYtd: 80_000_000, monthsWithData: 12 },
      rules,
    );
    expect(ingresos.status).toBe("far");
    expect(consignaciones.status).toBe("exceeded");
  });

  it("lista los topes que la app no puede medir", () => {
    expect(unmeasuredRentaThresholds(rules).map((t) => t.threshold)).toEqual([235_683_000, 73_323_600, 73_323_600]);
  });
});
