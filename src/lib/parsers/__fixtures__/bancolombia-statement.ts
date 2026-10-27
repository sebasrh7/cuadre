// Extracto SINTÉTICO de cuenta de ahorros de Bancolombia. Copia la estructura
// (posiciones, columnas, formatos) de un extracto real anonimizado, pero todos
// los nombres, números y montos son inventados. Nunca agregar datos reales.
//
// El periodo cruza de año (diciembre → enero) para probar la asignación del año.

import type { TextItem } from "../bancolombia-statement";

type Cell = [x: number, str: string];

export type FixtureMovement = {
  date: string; // D/MM, como lo imprime el banco
  description: Cell[];
  value: string;
  balance: string;
};

export const movements: FixtureMovement[] = [
  { date: "1/12", description: [[79, "ABONO INTERESES"], [156, "AHORROS"]], value: ".45", balance: "1,000,000.45" },
  { date: "3/12", description: [[79, "ABONO DE GIRO"], [146, "INTERNACIONAL"]], value: "3,850,000.00", balance: "4,850,000.45" },
  { date: "5/12", description: [[79, "COMPRA EN TIENDA"], [170, "EJEMPLO"]], value: "-45,900.00", balance: "4,804,100.45" },
  { date: "15/12", description: [[79, "TRANSF A ANDRES"], [170, "PRUEBA EJEMPLO"]], value: "-500,000.00", balance: "4,304,100.45" },
  // Página 2
  { date: "20/12", description: [[79, "TRANSFERENCIAS"], [151, "A"], [161, "NEQUI"]], value: "-200,000.00", balance: "4,104,100.45" },
  { date: "2/01", description: [[79, "PAGO QR CAFE"], [146, "EJEMPLO"]], value: "-12,500.00", balance: "4,091,600.45" },
  { date: "3/01", description: [[79, "AJUSTE INTERES"], [151, "AHORROS"], [189, "DB"]], value: "-.12", balance: "4,091,600.33" },
  { date: "4/01", description: [[79, "ABONO INTERESES"], [156, "AHORROS"]], value: "1.20", balance: "4,091,601.53" },
];

export const summary = {
  previous: "1,000,000.00",
  credits: "3,850,001.65",
  debits: "758,400.12",
  current: "4,091,601.53",
};

function header(page: number): TextItem[][] {
  return [
    [[407, "ESTADO DE CUENTA"]],
    [[332, "DESDE: 2026/11/30"], [450, "HASTA:"], [490, "2027/01/31"]],
    [[332, "CUENTA DE AHORROS"]],
    [[17, "TITULAR DE PRUEBA"]],
    [[332, "NÚMERO"], [400, "12345678901"]],
    [[332, "SUCURSAL EJEMPLO"]],
  ].map((cells, i) => items(page, 715 - i * 15, cells as Cell[]));
}

function items(page: number, y: number, cells: Cell[]): TextItem[] {
  return cells.map(([x, str]) => ({ page, x, y, str }));
}

function movementRow(page: number, y: number, m: FixtureMovement): TextItem[] {
  const valueX = m.value.startsWith("-") ? 453 : 487;
  return items(page, y, [[35, m.date], ...m.description, [valueX, m.value], [549, m.balance]]);
}

const tableHeader: Cell[] = [[32, "FECHA"], [132, "DESCRIPCIÓN"], [270, "SUCURSAL"], [355, "DCTO."], [434, "VALOR"], [549, "SALDO"]];

/** Arma el extracto completo; los parámetros permiten romperlo a propósito en los tests. */
export function buildStatement({
  rows = movements,
  totals = summary,
}: { rows?: FixtureMovement[]; totals?: typeof summary } = {}): TextItem[] {
  const page1 = rows.slice(0, 4);
  const page2 = rows.slice(4);
  return [
    ...header(1).flat(),
    ...items(1, 486, [[288, "RESUMEN"]]),
    ...items(1, 473, [[45, "SALDO ANTERIOR"], [140, "$"], [222, totals.previous], [330, "SALDO"], [359, "PROMEDIO"], [465, "$"], [537, "2,500,000"]]),
    ...items(1, 458, [[45, "TOTAL ABONOS"], [140, "$"], [222, totals.credits]]),
    ...items(1, 443, [[45, "TOTAL CARGOS"], [140, "$"], [222, totals.debits], [330, "VALOR"], [359, "INTERESES"], [465, "$"], [548, "1.53"]]),
    ...items(1, 428, [[45, "SALDO ACTUAL"], [140, "$"], [222, totals.current]]),
    ...items(1, 410, tableHeader),
    ...page1.flatMap((m, i) => movementRow(1, 396 - i * 10, m)),
    ...items(1, 7, [[530, "PÁGINA:"], [575, "1"]]),
    ...header(2).flat(),
    ...items(2, 603, tableHeader),
    ...page2.flatMap((m, i) => movementRow(2, 585 - i * 9, m)),
    ...items(2, 500, [[79, "FIN ESTADO"], [132, "DE"], [146, "CUENTA"]]),
    ...items(2, 7, [[530, "PÁGINA:"], [575, "2"]]),
  ];
}
