// Extracto SINTÉTICO de la tarjeta de crédito Nu. Copia la estructura
// (posiciones, columnas, año debajo de la fecha, descriptor `Pago*` y desglose
// de los pagos) de un extracto real, pero todos los nombres, números y montos
// son inventados. Nunca agregar datos reales.

import type { TextItem } from "../statement";

type Cell = [x: number, str: string];

export type NuCardFixtureRow = {
  date: string; // `05 SEP`
  year: string;
  lines: [string, string?];
  value: string;
  installments?: string;
  monthValue?: string;
  rate?: string;
  interest?: string;
  total: string;
  pending: string;
  breakdown?: string[];
};

export const nuCardRows: NuCardFixtureRow[] = [
  {
    date: "05 SEP",
    year: "2026",
    lines: ["Spotify", "Pago*Spotify Bogota"],
    value: "$26.900,00",
    installments: "1 de 1",
    monthValue: "$26.900,00",
    rate: "0.00%",
    interest: "$0,00",
    total: "$26.900,00",
    pending: "$0,00",
  },
  {
    date: "10 SEP",
    year: "2026",
    lines: ["Pago"],
    value: "$650.000,00",
    total: "-$300.000,00",
    pending: "$0,00",
    breakdown: ["↪ A capital $640.000,00", "↪ A intereses $6.000,00", "↪ A cargos y comisiones $4.000,00"],
  },
  // Compra a cuotas de un periodo anterior: conserva su fecha de compra.
  {
    date: "20 AGO",
    year: "2026",
    lines: ["Celulares Ejemplo", "Pago*Tienda Celulares"],
    value: "$900.000,00",
    installments: "2 de 3",
    monthValue: "$300.000,00",
    rate: "1.99%",
    interest: "$5.970,00",
    total: "$305.970,00",
    pending: "$300.000,00",
  },
];

export const nuCardSummary = {
  due: "$326.900,00",
  interest: "+ $5.970,00",
  advanceFees: "+ $0,00",
  fees: "+ $0,00",
  charges: "+ $4.000,00",
  payments: "- $300.000,00",
  refunds: "- $0,00",
  minimum: "$36.870,00",
  pending: "+ $300.000,00",
  total: "$336.870,00",
};

function items(page: number, y: number, cells: Cell[]): TextItem[] {
  return cells.map(([x, str]) => ({ page, x, y, str }));
}

export function buildNuCardStatement({
  rows = nuCardRows,
  totals = nuCardSummary,
}: { rows?: NuCardFixtureRow[]; totals?: typeof nuCardSummary } = {}): TextItem[] {
  const summaryRow = (y: number, label: string, value: string) => items(1, y, [[292, label], [510, value]]);
  let y = 838;
  const table = rows.flatMap((r) => {
    const top = y;
    y -= 46;
    return [
      ...items(2, top, [
        [30, r.date],
        [80, r.lines[0]],
        [150, r.value],
        ...(r.installments ? [[210, r.installments] as Cell] : []),
        ...(r.monthValue ? [[258, r.monthValue] as Cell] : []),
        ...(r.rate ? [[320, r.rate] as Cell] : []),
        ...(r.interest ? [[357, r.interest] as Cell] : []),
        [422, r.total],
        [504, r.pending],
      ]),
      ...items(2, top - 12, [[30, r.year], ...(r.lines[1] ? [[80, r.lines[1]] as Cell] : [])]),
      ...(r.breakdown ?? []).flatMap((b, i) => items(2, top - 7 - i * 8.5, [[150, b]])),
    ];
  });

  return [
    ...items(1, 818, [[31, "Hola, TITULAR"]]),
    ...items(1, 792, [[31, "Este es tu extracto de septiembre"]]),
    ...items(1, 750, [[31, "TITULAR DE PRUEBA"], [280, "Tus tarjetas"]]),
    ...items(1, 729, [[31, "CC 1234567890"], [280, "Tarjeta virtual"], [400, "Tarjeta física"]]),
    ...items(1, 703, [[31, "Cali, Valle"], [280, "• • • • 4321"], [400, "• • • • 8765"]]),
    ...items(1, 652, [[149, "Fecha límite de pago"], [282, "Fecha de corte"], [425, "Periodo facturado"]]),
    ...items(1, 633, [[149, "13 OCT 2026"], [282, "28 SEP 2026"], [425, "29 AGO 2026 - 28 SEP"]]),
    ...items(1, 583, [[30, "Resumen de tu extracto"]]),
    ...summaryRow(537, "Deuda a pagar este mes", totals.due),
    ...items(1, 516, [[45, "Tu cupo total $2.000.000,00"]]),
    ...summaryRow(513, "Intereses", totals.interest),
    ...summaryRow(489, "Comisiones de avances", totals.advanceFees),
    ...items(1, 477, [[45, "Usado"], [203, "Disponible"]]),
    ...items(1, 467, [[45, "$1.226.900,00"], [196, "$773.100,00"], [292, "Comisiones por mora"], [529, totals.fees]]),
    ...summaryRow(441, "Cargos por seguro", totals.charges),
    ...summaryRow(417, "Abonos", totals.payments),
    ...summaryRow(393, "Devoluciones y ajustes a tu favor", totals.refunds),
    ...summaryRow(361, "PAGO MÍNIMO", totals.minimum),
    ...summaryRow(335, "Deuda pendiente", totals.pending),
    ...summaryRow(308, "DEUDA TOTAL HASTA EL 28 SEP", totals.total),
    ...items(2, 873, [
      [30, "Fecha"],
      [80, "Descripción"],
      [150, "Valor"],
      [210, "Cuotas"],
      [258, "Valor"],
      [320, "Interés del mes"],
      [422, "Total a pagar"],
      [504, "Saldo"],
    ]),
    ...items(2, 866, [[258, "del mes"], [320, "tasa y valor"], [422, "este mes"], [504, "por pagar"]]),
    ...table,
    ...items(2, y - 10, [[422, "Pago mínimo"]]),
    ...items(2, y - 26, [[422, totals.minimum]]),
    ...items(2, 310, [[30, "¿Tienes dudas sobre tu extracto?"]]),
  ];
}
