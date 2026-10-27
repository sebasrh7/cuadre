// Copia de las filas de 2026 de supabase/migrations/20261028000000_tax_rules.sql,
// para probar los cálculos sin base de datos. Si cambia la migración, cambia aquí.

const row = (key: string, value: number, unit: string) => ({
  year: 2026,
  key,
  value,
  unit,
  norm: "norma de prueba",
  source_url: "https://example.com/fuente",
});

export const rules2026Rows = [
  row("uvt", 52374, "cop"),
  row("smmlv", 1750905, "cop"),
  row("renta_tope_ingresos", 1400, "uvt"),
  row("renta_tope_patrimonio", 4500, "uvt"),
  row("renta_tope_consignaciones", 1400, "uvt"),
  row("renta_tope_consumos_tarjeta", 1400, "uvt"),
  row("renta_tope_compras", 1400, "uvt"),
  row("ss_obligacion_desde", 1, "smmlv"),
  row("ss_ibc_porcentaje", 40, "percent"),
  row("ss_ibc_minimo", 1, "smmlv"),
  row("ss_ibc_maximo", 25, "smmlv"),
  row("ss_salud", 12.5, "percent"),
  row("ss_pension", 16, "percent"),
  row("arl_riesgo_1", 0.522, "percent"),
  row("arl_riesgo_2", 1.044, "percent"),
  row("arl_riesgo_3", 2.436, "percent"),
  row("arl_riesgo_4", 4.35, "percent"),
  row("arl_riesgo_5", 6.96, "percent"),
];
