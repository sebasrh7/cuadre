import { applyPer100k, type TaxRules } from "./rules";

export interface SocialSecurityEstimate {
  /** Con ingresos de 1 SMMLV o más, aportar es obligatorio. */
  obligated: boolean;
  /** 40 % del ingreso, antes de aplicar el piso y el techo. */
  ibcRaw: number;
  ibc: number;
  /** El 40 % quedó por debajo del mínimo y se cotiza sobre 1 SMMLV. */
  ibcAtFloor: boolean;
  health: number;
  pension: number;
  arl: number;
  total: number;
}

/**
 * Aportes mensuales de un independiente con contrato de prestación de
 * servicios: IBC = 40 % del ingreso del mes (sin restar costos), con piso de
 * 1 SMMLV y techo de 25. Se pagan mes vencido por PILA.
 */
export function estimateSocialSecurity(
  monthlyIncome: number,
  arlRisk: 1 | 2 | 3 | 4 | 5,
  rules: TaxRules,
): SocialSecurityEstimate {
  const ss = rules.socialSecurity;
  const floor = ss.ibcMinSmmlv * rules.smmlv;
  const ceiling = ss.ibcMaxSmmlv * rules.smmlv;

  const ibcRaw = applyPer100k(monthlyIncome, ss.ibcPer100k);
  const ibc = Math.min(Math.max(ibcRaw, floor), ceiling);

  const health = applyPer100k(ibc, ss.healthPer100k);
  const pension = applyPer100k(ibc, ss.pensionPer100k);
  const arl = applyPer100k(ibc, ss.arlPer100k[arlRisk - 1]);

  return {
    obligated: monthlyIncome >= ss.obligationFromSmmlv * rules.smmlv,
    ibcRaw,
    ibc,
    ibcAtFloor: ibcRaw < floor,
    health,
    pension,
    arl,
    total: health + pension + arl,
  };
}
