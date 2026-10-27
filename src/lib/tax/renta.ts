import type { TaxRules } from "./rules";

export type RentaStatus =
  /** Ya pasó el tope: debe declarar. */
  | "exceeded"
  /** Si sigue al mismo ritmo, lo pasará antes de fin de año. */
  | "likely"
  /** La proyección llega al 80 % del tope o más. */
  | "close"
  | "far";

export interface RentaCheck {
  key: "ingresos" | "consignaciones";
  threshold: number;
  actual: number;
  projected: number;
  status: RentaStatus;
}

export interface RentaInput {
  /** Ingresos del año (sin transferencias propias). */
  incomeYtd: number;
  /** Todo lo que entró a las cuentas, incluidas transferencias propias: la DIAN mira consignaciones, no ingresos. */
  depositsYtd: number;
  /** Meses del año con datos importados; se usa para proyectar. */
  monthsWithData: number;
}

const CLOSE_PER_100 = 80;

/**
 * Compara lo que la app conoce (ingresos y consignaciones) con los topes del
 * año. La proyección asume que los meses sin datos se parecen al promedio de
 * los que sí tienen. Los topes que la app no puede medir (patrimonio, compras,
 * tarjeta de crédito) se muestran aparte para que el usuario los revise.
 */
export function checkRenta(input: RentaInput, rules: TaxRules): RentaCheck[] {
  const toPesos = (uvt: number) => uvt * rules.uvt;
  const project = (amount: number) =>
    input.monthsWithData > 0 ? Math.round((amount / input.monthsWithData) * 12) : amount;

  const check = (key: RentaCheck["key"], actual: number, thresholdUvt: number): RentaCheck => {
    const threshold = toPesos(thresholdUvt);
    const projected = Math.max(project(actual), actual);
    const status: RentaStatus =
      actual >= threshold
        ? "exceeded"
        : projected >= threshold
          ? "likely"
          : projected * 100 >= threshold * CLOSE_PER_100
            ? "close"
            : "far";
    return { key, threshold, actual, projected, status };
  };

  return [
    check("ingresos", input.incomeYtd, rules.renta.ingresosUvt),
    check("consignaciones", input.depositsYtd, rules.renta.consignacionesUvt),
  ];
}

/** Topes que dependen de datos que la app no tiene. */
export function unmeasuredRentaThresholds(rules: TaxRules) {
  return [
    { label: "Patrimonio bruto al 31 de diciembre", threshold: rules.renta.patrimonioUvt * rules.uvt },
    { label: "Compras con tarjeta de crédito en el año", threshold: rules.renta.consumosTarjetaUvt * rules.uvt },
    { label: "Compras y consumos totales en el año", threshold: rules.renta.comprasUvt * rules.uvt },
  ];
}
