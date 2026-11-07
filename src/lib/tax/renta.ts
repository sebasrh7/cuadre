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
  key: "ingresos" | "consignaciones" | "compras" | "tarjeta" | "patrimonio";
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
  /** Gastos del año sin transferencias a personas. Sin el dato, el tope queda para revisar a mano. */
  purchasesYtd?: number;
  /** Gastos con tarjetas de crédito registradas. Sin tarjetas, el tope queda para revisar a mano. */
  creditCardYtd?: number;
  /** Saldos y bienes que conoce la app. No se proyecta: el tope es sobre el 31 de diciembre. */
  patrimonio?: number;
}

const CLOSE_PER_100 = 80;

/**
 * Compara lo que la app conoce con los topes del año. La proyección asume que
 * los meses sin datos se parecen al promedio de los que sí tienen. Los topes
 * sin dato (por ejemplo, patrimonio si el usuario no tiene saldos ni bienes
 * registrados) se muestran aparte para que el usuario los revise.
 */
export function checkRenta(input: RentaInput, rules: TaxRules): RentaCheck[] {
  const toPesos = (uvt: number) => uvt * rules.uvt;
  const project = (amount: number) =>
    input.monthsWithData > 0 ? Math.round((amount / input.monthsWithData) * 12) : amount;

  const check = (key: RentaCheck["key"], actual: number, thresholdUvt: number, projectable = true): RentaCheck => {
    const threshold = toPesos(thresholdUvt);
    const projected = projectable ? Math.max(project(actual), actual) : actual;
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

  const checks = [
    check("ingresos", input.incomeYtd, rules.renta.ingresosUvt),
    check("consignaciones", input.depositsYtd, rules.renta.consignacionesUvt),
  ];
  if (input.purchasesYtd !== undefined) checks.push(check("compras", input.purchasesYtd, rules.renta.comprasUvt));
  if (input.creditCardYtd !== undefined) {
    checks.push(check("tarjeta", input.creditCardYtd, rules.renta.consumosTarjetaUvt));
  }
  if (input.patrimonio !== undefined) checks.push(check("patrimonio", input.patrimonio, rules.renta.patrimonioUvt, false));
  return checks;
}

/** Topes que la app no pudo medir con los datos del usuario. */
export function unmeasuredRentaThresholds(rules: TaxRules, measured: RentaCheck["key"][] = []) {
  return [
    { key: "patrimonio", label: "Patrimonio bruto al 31 de diciembre", threshold: rules.renta.patrimonioUvt * rules.uvt },
    {
      key: "tarjeta",
      label: "Compras con tarjeta de crédito en el año",
      threshold: rules.renta.consumosTarjetaUvt * rules.uvt,
    },
    { key: "compras", label: "Compras y consumos totales en el año", threshold: rules.renta.comprasUvt * rules.uvt },
  ].filter((t) => !measured.includes(t.key as RentaCheck["key"]));
}
