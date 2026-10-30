/** Tipos de bien que el usuario puede registrar. El valor es la etiqueta que ve. */
export const ASSET_KINDS = {
  real_estate: "Casa, apartamento o lote",
  vehicle: "Carro o moto",
  investment: "Inversión (CDT, fondo, acciones)",
  crypto: "Criptomonedas",
  other: "Otro",
} as const;

export type AssetKind = keyof typeof ASSET_KINDS;

export interface PatrimonioAccount {
  kind: string;
  balanceCop: number | null;
}

/**
 * Patrimonio bruto que conoce la app: saldos de las cuentas más los bienes
 * registrados. Las tarjetas de crédito no suman (son deuda) y las deudas no se
 * restan: el tope de la DIAN es sobre el patrimonio bruto. Devuelve `null` si
 * no hay ningún dato, para no mostrar un "lejos del tope" con $0.
 */
export function patrimonioTotal(accounts: PatrimonioAccount[], assets: { valueCop: number }[]): number | null {
  const withBalance = accounts.filter((a) => a.kind !== "credit_card" && a.balanceCop !== null);
  if (!withBalance.length && !assets.length) return null;
  return (
    withBalance.reduce((t, a) => t + (a.balanceCop ?? 0), 0) + assets.reduce((t, a) => t + a.valueCop, 0)
  );
}
