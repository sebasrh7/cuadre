// Extracto SINTÉTICO de Nequi. Copia la estructura (posiciones, columnas,
// formatos y orden del más reciente al más antiguo) de un extracto real
// anonimizado, pero todos los nombres, números y montos son inventados.
// Nunca agregar datos reales.

import type { TextItem } from "../statement";

type Cell = [x: number, str: string];

export type NequiFixtureMovement = { date: string; description: string; value: string; balance: string };

/** Del más antiguo al más reciente (el PDF los imprime al revés). */
export const nequiMovements: NequiFixtureMovement[] = [
  { date: "01/09/2026", description: "Recarga desde Bancolombia", value: "$200,000.00", balance: "$700,000.00" },
  { date: "03/09/2026", description: "De ANA PRUEBA", value: "$150,000.00", balance: "$850,000.00" },
  { date: "05/09/2026", description: "PAGO EN QR BRE-B: PANADERIA EJEMPLO", value: "$-12,500.00", balance: "$837,500.00" },
  { date: "10/09/2026", description: "ENVIO CON BRE-B A: LAURA EJEMPLO", value: "$-80,000.00", balance: "$757,500.00" },
  { date: "15/09/2026", description: "Para ANDRES PRUEBA EJEMPLO", value: "$-100,000.00", balance: "$657,500.00" },
  { date: "20/09/2026", description: "COMPRA PIN PTM NETFLIX", value: "$-26,900.00", balance: "$630,600.00" },
  { date: "25/09/2026", description: "Pago en TIGO FACTURAS EE", value: "$-60,000.00", balance: "$570,600.00" },
  { date: "30/09/2026", description: "Pago de Intereses", value: "$45.67", balance: "$570,645.67" },
];

export const nequiSummary = {
  previous: "$500,000.00",
  credits: "$350,045.67",
  debits: "$279,400.00",
  current: "$570,645.67",
};

function items(page: number, y: number, cells: Cell[]): TextItem[] {
  return cells.map(([x, str]) => ({ page, x, y, str }));
}

const tableHeader: Cell[] = [[64, "Fecha del movimiento"], [232, "Descripción"], [386, "Valor"], [481, "Saldo"]];

export function buildNequiStatement({
  rows = nequiMovements,
  totals = nequiSummary,
}: { rows?: NequiFixtureMovement[]; totals?: typeof nequiSummary } = {}): TextItem[] {
  const newestFirst = [...rows].reverse();
  const page1 = newestFirst.slice(0, 5);
  const page2 = newestFirst.slice(5);
  const row = (page: number, y: number, m: NequiFixtureMovement) =>
    items(page, y, [[91, m.date], [181, m.description], [m.value.includes("-") ? 393 : 396, m.value], [477, m.balance]]);

  return [
    ...items(1, 681, [[166, "Extracto de Cuenta de Ahorros de:"]]),
    ...items(1, 658, [[180, "NEQUI S.A. Compañía de Financiamiento"]]),
    ...items(1, 616, [[56, "TITULAR DE PRUEBA"]]),
    ...items(1, 589, [[56, "Número de cuenta: 3009998877"]]),
    ...items(1, 553, [[103, "Estado de cuenta de ahorros para el período de: 2026/09/01 a 2026/09/30"]]),
    ...items(1, 522, [[275, "Resumen"]]),
    ...items(1, 502, [[61, "Saldo anterior"], [197, totals.previous], [271, "Saldo promedio"], [477, "$600,000.00"]]),
    ...items(1, 482, [[61, "Total abonos"], [197, totals.credits]]),
    ...items(1, 462, [[61, "Total cargos"], [197, totals.debits], [271, "Valor de intereses pagados"], [502, "$45.67"]]),
    ...items(1, 442, [[61, "Saldo actual"], [205, totals.current]]),
    ...items(1, 398, tableHeader),
    ...page1.flatMap((m, i) => row(1, 378 - i * 20, m)),
    ...items(2, 698, tableHeader),
    ...page2.flatMap((m, i) => row(2, 678 - i * 20, m)),
  ];
}
