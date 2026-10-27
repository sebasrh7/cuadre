import { parseCopAmount } from "./amount";

/** Fecha y hora locales de Colombia, tal como las reporta el banco. */
interface AlertBase {
  amountCop: number;
  /** `YYYY-MM-DD` */
  date: string;
  /** `HH:MM`, o `null` si la alerta no la trae. */
  time: string | null;
  /** Últimos 4 dígitos de la cuenta o tarjeta del usuario. */
  accountLast4: string;
}

export type BancolombiaAlert =
  | (AlertBase & {
      kind: "card_purchase";
      merchant: string;
      cardType: "debit" | "credit";
    })
  | (AlertBase & {
      kind: "transfer_out_key";
      counterpartyName: string;
      counterpartyKey: string;
    })
  | (AlertBase & {
      kind: "transfer_out_account";
      /** Solo los últimos 4 dígitos: nunca se guarda la cuenta completa. */
      counterpartyAccountLast4: string;
    })
  | (AlertBase & {
      kind: "transfer_in";
      counterpartyName: string;
      /** Llave del usuario donde se recibió el dinero; no identifica a quien envía. */
      receivingKey: string;
    });

export type ParseAlertResult =
  | { ok: true; alert: BancolombiaAlert }
  | { ok: false; reason: "unrecognized" };

const AMOUNT = String.raw`\$\s?([\d.,]+)`;
const DATE = String.raw`(\d{2}/\d{2}/\d{2,4})`;
const TIME = String.raw`(\d{2}:\d{2})`;

const CARD_PURCHASE = new RegExp(
  String.raw`Compraste ${AMOUNT} en (.+?) con tu T\.\s?(Deb|Cred)\w* \*(\d{4}),? el ${DATE} a las ${TIME}`,
  "i",
);
const TRANSFER_OUT_KEY = new RegExp(
  String.raw`transferiste ${AMOUNT} a la llave (\S+) desde tu cuenta \*(\d{4}) a (.+?) el ${DATE} a las ${TIME}`,
  "i",
);
const TRANSFER_OUT_ACCOUNT = new RegExp(
  String.raw`transferiste ${AMOUNT} desde tu cuenta \*(\d{4}) a la cuenta \*(\d{4,}) el ${DATE} a las ${TIME}`,
  "i",
);
const TRANSFER_IN = new RegExp(
  String.raw`recibiste una transferencia de (.+?) por ${AMOUNT} en tu cuenta \*(\d{4}) conectada a la llave (\S+) el ${DATE}(?: a las ${TIME})?`,
  "i",
);

/**
 * Lee una alerta de Bancolombia (texto pegado del correo, SMS o notificación).
 * Acepta el cuerpo completo del correo: el texto alrededor de la alerta se ignora.
 */
export function parseBancolombiaAlert(text: string): ParseAlertResult {
  const normalized = text.replace(/\s+/g, " ");

  let m = CARD_PURCHASE.exec(normalized);
  if (m) {
    const [, amount, merchant, cardType, last4, date, time] = m;
    return ok({
      kind: "card_purchase",
      amountCop: parseCopAmount(amount),
      merchant: merchant.trim(),
      cardType: cardType.toLowerCase() === "deb" ? "debit" : "credit",
      accountLast4: last4,
      date: parseDate(date),
      time,
    });
  }

  m = TRANSFER_OUT_KEY.exec(normalized);
  if (m) {
    const [, amount, key, last4, name, date, time] = m;
    return ok({
      kind: "transfer_out_key",
      amountCop: parseCopAmount(amount),
      counterpartyKey: key,
      counterpartyName: name.trim(),
      accountLast4: last4,
      date: parseDate(date),
      time,
    });
  }

  m = TRANSFER_OUT_ACCOUNT.exec(normalized);
  if (m) {
    const [, amount, last4, destination, date, time] = m;
    return ok({
      kind: "transfer_out_account",
      amountCop: parseCopAmount(amount),
      accountLast4: last4,
      counterpartyAccountLast4: destination.slice(-4),
      date: parseDate(date),
      time,
    });
  }

  m = TRANSFER_IN.exec(normalized);
  if (m) {
    const [, name, amount, last4, key, date, time] = m;
    return ok({
      kind: "transfer_in",
      amountCop: parseCopAmount(amount),
      counterpartyName: name.trim(),
      receivingKey: key,
      accountLast4: last4,
      date: parseDate(date),
      time: time ?? null,
    });
  }

  return { ok: false, reason: "unrecognized" };
}

function ok(alert: BancolombiaAlert): ParseAlertResult {
  return { ok: true, alert };
}

/** `DD/MM/YY` o `DD/MM/YYYY` → `YYYY-MM-DD`. */
function parseDate(raw: string): string {
  const [day, month, year] = raw.split("/");
  const fullYear = year.length === 2 ? `20${year}` : year;
  return `${fullYear}-${month}-${day}`;
}
