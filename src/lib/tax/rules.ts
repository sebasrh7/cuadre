import { z } from "zod";

/** Fila de `tax_rules` tal como llega de la base de datos. */
export const taxRuleRowSchema = z.object({
  year: z.number().int(),
  key: z.string(),
  value: z.coerce.number(),
  unit: z.enum(["cop", "uvt", "smmlv", "percent"]),
  norm: z.string(),
  source_url: z.url(),
});

export type TaxRuleRow = z.infer<typeof taxRuleRowSchema>;

/**
 * Los porcentajes se guardan como partes por 100.000 (12,5 % → 12.500) para
 * calcular aportes con enteros y no con decimales flotantes.
 */
export interface TaxRules {
  year: number;
  uvt: number;
  smmlv: number;
  renta: {
    ingresosUvt: number;
    patrimonioUvt: number;
    consignacionesUvt: number;
    consumosTarjetaUvt: number;
    comprasUvt: number;
  };
  socialSecurity: {
    obligationFromSmmlv: number;
    ibcPer100k: number;
    ibcMinSmmlv: number;
    ibcMaxSmmlv: number;
    healthPer100k: number;
    pensionPer100k: number;
    /** Índice 0 = riesgo I. */
    arlPer100k: [number, number, number, number, number];
  };
  sources: { key: string; norm: string; url: string }[];
}

const REQUIRED = [
  "uvt",
  "smmlv",
  "renta_tope_ingresos",
  "renta_tope_patrimonio",
  "renta_tope_consignaciones",
  "renta_tope_consumos_tarjeta",
  "renta_tope_compras",
  "ss_obligacion_desde",
  "ss_ibc_porcentaje",
  "ss_ibc_minimo",
  "ss_ibc_maximo",
  "ss_salud",
  "ss_pension",
  "arl_riesgo_1",
  "arl_riesgo_2",
  "arl_riesgo_3",
  "arl_riesgo_4",
  "arl_riesgo_5",
] as const;

/** Convierte las filas de un año en reglas tipadas, o falla si falta alguna. */
export function buildTaxRules(rows: unknown[]): TaxRules {
  const parsed = rows.map((row) => taxRuleRowSchema.parse(row));
  const byKey = new Map(parsed.map((r) => [r.key, r]));
  const missing = REQUIRED.filter((key) => !byKey.has(key));
  if (missing.length) throw new Error(`Faltan reglas fiscales: ${missing.join(", ")}`);

  const value = (key: (typeof REQUIRED)[number]) => byKey.get(key)!.value;
  const per100k = (key: (typeof REQUIRED)[number]) => Math.round(value(key) * 1000);

  return {
    year: parsed[0].year,
    uvt: value("uvt"),
    smmlv: value("smmlv"),
    renta: {
      ingresosUvt: value("renta_tope_ingresos"),
      patrimonioUvt: value("renta_tope_patrimonio"),
      consignacionesUvt: value("renta_tope_consignaciones"),
      consumosTarjetaUvt: value("renta_tope_consumos_tarjeta"),
      comprasUvt: value("renta_tope_compras"),
    },
    socialSecurity: {
      obligationFromSmmlv: value("ss_obligacion_desde"),
      ibcPer100k: per100k("ss_ibc_porcentaje"),
      ibcMinSmmlv: value("ss_ibc_minimo"),
      ibcMaxSmmlv: value("ss_ibc_maximo"),
      healthPer100k: per100k("ss_salud"),
      pensionPer100k: per100k("ss_pension"),
      arlPer100k: [
        per100k("arl_riesgo_1"),
        per100k("arl_riesgo_2"),
        per100k("arl_riesgo_3"),
        per100k("arl_riesgo_4"),
        per100k("arl_riesgo_5"),
      ],
    },
    sources: parsed.map((r) => ({ key: r.key, norm: r.norm, url: r.source_url })),
  };
}

/** `amount × porcentaje`, redondeado al peso. */
export function applyPer100k(amount: number, per100k: number): number {
  return Math.round((amount * per100k) / 100_000);
}
