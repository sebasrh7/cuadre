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

/**
 * El extracto corta los nombres a ~12 caracteres ("SEBASTIAN RE"): un nombre
 * cortado es propio si es el comienzo de un nombre propio. Se exige un mínimo
 * de largo para que "ANA" no coincida con "ANA MARÍA …" por accidente. Al
 * revés, Nu manda el nombre completo: "ANDRES PRUEBA EJEMPLO" es propio si el
 * usuario registró "Andrés Prueba" (nombre y al menos un apellido).
 */
export function matchesOwnName(name: string, ownNames: string[]): boolean {
  const candidate = normalizeName(name);
  return ownNames.some((own) => {
    const full = normalizeName(own);
    return (
      full === candidate ||
      (candidate.length >= 8 && full.startsWith(candidate)) ||
      (full.includes(" ") && candidate.startsWith(`${full} `))
    );
  });
}

/** Las llaves llegan con mayúsculas inconsistentes (`@abc123` y `@ABC123`). */
function normalizeKey(key: string): string {
  return key.trim().toLowerCase();
}

/** Ignora mayúsculas, tildes y espacios repetidos. */
export function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}
