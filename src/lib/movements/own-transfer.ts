import type { BancolombiaAlert } from "@/lib/parsers/bancolombia-alert";

/** Lo que el usuario registra como suyo en el onboarding. */
export interface OwnIdentity {
  names: string[];
  keys: string[];
  accountsLast4: string[];
}

/**
 * Una transferencia entre cuentas del mismo titular no es ingreso ni gasto.
 * Contarla inflaría ambos totales.
 */
export function isOwnTransfer(alert: BancolombiaAlert, own: OwnIdentity): boolean {
  switch (alert.kind) {
    case "card_purchase":
      return false;
    case "transfer_out_account":
      return own.accountsLast4.includes(alert.counterpartyAccountLast4);
    case "transfer_out_key":
      return (
        own.keys.some((key) => normalizeKey(key) === normalizeKey(alert.counterpartyKey)) ||
        isOwnName(alert.counterpartyName, own)
      );
    case "transfer_in":
      // La llave de una transferencia recibida es la del usuario: solo el nombre identifica al remitente.
      return isOwnName(alert.counterpartyName, own);
  }
}

function isOwnName(name: string, own: OwnIdentity): boolean {
  return own.names.some((ownName) => normalizeName(ownName) === normalizeName(name));
}

/** Las llaves llegan con mayúsculas inconsistentes (`@abc123` y `@ABC123`). */
function normalizeKey(key: string): string {
  return key.trim().toLowerCase();
}

/** Ignora mayúsculas, tildes y espacios repetidos. */
function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}
