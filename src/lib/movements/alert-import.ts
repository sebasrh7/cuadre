import type { BancolombiaAlert } from "@/lib/parsers/bancolombia-alert";
import { isOwnTransfer, type OwnIdentity } from "./own-transfer";
import { TRANSFER_CATEGORY, type PlannedMovement } from "./statement-import";

export interface PlannedAlertMovement extends PlannedMovement {
  occurredAtTime: string | null;
}

/**
 * Convierte alertas en movimientos. Las alertas adelantan el mes en curso;
 * cuando llega el extracto, cada movimiento del extracto reemplaza su alerta.
 */
export function planAlertImport(alerts: BancolombiaAlert[], own: OwnIdentity): PlannedAlertMovement[] {
  const seen = new Map<string, number>();
  return alerts.map((alert) => {
    const isOwn = isOwnTransfer(alert, own);
    const direction = alert.kind === "transfer_in" ? "in" : "out";
    const counterparty = counterpartyOf(alert);

    const base = `alert|${alert.kind}|${alert.accountLast4}|${alert.date}|${alert.time ?? ""}|${alert.amountCop}|${counterparty}`;
    // La misma alerta pegada dos veces es una sola; dos compras iguales en el mismo minuto no se distinguen.
    const occurrence = seen.get(base) ?? 0;
    seen.set(base, occurrence + 1);

    return {
      occurredOn: alert.date,
      occurredAtTime: alert.time,
      amountCop: alert.amountCop,
      direction,
      kind: isOwn ? "own_transfer" : direction === "in" ? "income" : "expense",
      counterparty,
      // Pagos a personas o cuentas: se categorizan aquí para que esos nombres nunca lleguen a la IA.
      category: !isOwn && direction === "out" && alert.kind !== "card_purchase" ? TRANSFER_CATEGORY : null,
      accountLast4: alert.accountLast4,
      dedupeKey: `${base}|${occurrence}`,
    };
  });
}

function counterpartyOf(alert: BancolombiaAlert): string {
  switch (alert.kind) {
    case "card_purchase":
      return alert.merchant;
    case "transfer_out_key":
    case "transfer_in":
      return alert.counterpartyName;
    case "transfer_out_account":
      return `Cuenta *${alert.counterpartyAccountLast4}`;
  }
}

export interface MatchableMovement {
  id: string;
  occurredOn: string;
  amountCop: number;
  direction: "in" | "out";
}

const MAX_DAYS_APART = 1;

/**
 * Empareja movimientos que vinieron de alertas con los del extracto: mismo
 * monto y sentido, y fecha igual o a un día (el extracto a veces registra la
 * compra al día siguiente). Primero las fechas exactas; cada movimiento se usa
 * una sola vez.
 */
export function matchAlertsToStatement(
  alerts: MatchableMovement[],
  statement: MatchableMovement[],
): { alertId: string; statementId: string }[] {
  const used = new Set<string>();
  const pairs: { alertId: string; statementId: string }[] = [];

  for (const maxDays of [0, MAX_DAYS_APART]) {
    for (const alert of alerts) {
      if (pairs.some((p) => p.alertId === alert.id)) continue;
      const match = statement.find(
        (s) =>
          !used.has(s.id) &&
          s.amountCop === alert.amountCop &&
          s.direction === alert.direction &&
          daysApart(s.occurredOn, alert.occurredOn) <= maxDays,
      );
      if (!match) continue;
      used.add(match.id);
      pairs.push({ alertId: alert.id, statementId: match.id });
    }
  }
  return pairs;
}

function daysApart(a: string, b: string): number {
  return Math.abs(Date.parse(a) - Date.parse(b)) / 86_400_000;
}
