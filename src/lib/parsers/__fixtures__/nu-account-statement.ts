// Extracto SINTÉTICO de la Cuenta Nu. Copia la estructura (posiciones,
// etiquetas del resumen, formato colombiano de los montos y renglones sin
// fecha del 4x1000 y los rendimientos) de un extracto real, pero todos los
// nombres, números y montos son inventados. Nunca agregar datos reales.

import type { TextItem } from "../statement";

type Cell = [x: number, str: string];

/** `date` vacía: renglón sin fecha (4x1000 o rendimientos), como en el PDF. */
export type NuFixtureMovement = { date: string; description: string; value: string };

export const nuMovements: NuFixtureMovement[] = [
  { date: "02 sep", description: "Recibiste de ANA PRUEBA", value: "+$400.000,00" },
  { date: "05 sep", description: "Compra en TIENDA EJEMPLO con tarjeta débito", value: "-$50.000,00" },
  { date: "", description: "Impuesto del 4x1000", value: "-$200,00" },
  { date: "10 sep", description: "Recibiste de LAURA EJEMPLO", value: "+$200.000,00" },
  { date: "15 sep", description: "Pagaste tu tarjeta", value: "-$300.000,00" },
  { date: "", description: "Impuesto del 4x1000", value: "-$1.200,00" },
  { date: "", description: "Rendimiento total de tu cuenta", value: "+$1.234,56" },
];

export const nuSummary = {
  start: "$1.000.000,00",
  inflow: "+$600.000,00",
  outflow: "-$350.000,00",
  tax: "-$1.400,00",
  withdrawalFee: "$0,00",
  yield: "+$1.234,56",
  end: "$1.249.834,56",
};

function items(page: number, y: number, cells: Cell[]): TextItem[] {
  return cells.map(([x, str]) => ({ page, x, y, str }));
}

export function buildNuAccountStatement({
  rows = nuMovements,
  totals = nuSummary,
}: { rows?: NuFixtureMovement[]; totals?: typeof nuSummary } = {}): TextItem[] {
  const summaryRow = (y: number, label: string, value: string) => items(1, y, [[298, label], [477, value]]);
  return [
    ...items(1, 700, [[48, "Hola, TITULAR DE PRUEBA"]]),
    ...items(1, 674, [[48, "Calle 1 # 2-3"]]),
    ...items(1, 618, [[266, "Número de Cuenta"], [418, "Período"]]),
    ...items(1, 604, [[266, "12345678"], [418, "01 - 30 SEP 2026"]]),
    ...items(1, 475, [[110, "Dinero en tu Cuenta Nu"]]),
    ...summaryRow(497, "Tu dinero al inicio del mes", totals.start),
    ...summaryRow(466, "Lo que entró a tu cuenta", totals.inflow),
    ...summaryRow(435, "Lo que salió de tu cuenta", totals.outflow),
    ...summaryRow(404, "Impuesto del 4X1000", totals.tax),
    ...summaryRow(370, "Cobro por retiro", totals.withdrawalFee),
    ...summaryRow(336, "Rendimiento total de tu cuenta", totals.yield),
    ...summaryRow(302, "Tu dinero a final del mes", totals.end),
    ...items(1, 75, [[214, "Los rendimientos que genera tu cuenta los verás reflejados al final del mes."]]),
    ...items(2, 720, [[48, "Movimientos"]]),
    ...rows.flatMap((m, i) =>
      items(2, 690 - i * 24, [...(m.date ? [[68, m.date] as Cell] : []), [121, m.description], [m.value.startsWith("-") ? 459 : 463, m.value]]),
    ),
    ...items(2, 500, [[121, "Los rendimientos se calculan sobre tu saldo diario."]]),
  ];
}
