"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button, FormError } from "@/components/ui";
import { isOwnTransfer, type OwnIdentity } from "@/lib/movements/own-transfer";
import { formatCop } from "@/lib/money/format";
import { parseBancolombiaAlerts, type BancolombiaAlert } from "@/lib/parsers/bancolombia-alert";
import { saveAlerts, type SaveAlertsResult } from "./actions";

const LABELS: Record<BancolombiaAlert["kind"], string> = {
  card_purchase: "Compra",
  transfer_out_key: "Transferencia enviada",
  transfer_out_account: "Transferencia enviada",
  transfer_in: "Transferencia recibida",
};

function describe(alert: BancolombiaAlert): string {
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

export function AlertPaster({ own }: { own: OwnIdentity }) {
  const [text, setText] = useState("");
  const [alerts, setAlerts] = useState<BancolombiaAlert[] | null>(null);
  const [result, setResult] = useState<Extract<SaveAlertsResult, { ok: true }>>();
  const [error, setError] = useState<string>();
  const [saving, start] = useTransition();

  function read() {
    setError(undefined);
    const found = parseBancolombiaAlerts(text);
    if (!found.length) {
      setAlerts(null);
      setError("No encontramos alertas de compras o transferencias de Bancolombia en ese texto.");
      return;
    }
    setAlerts(found);
  }

  function save() {
    if (!alerts) return;
    start(async () => {
      const saved = await saveAlerts(alerts);
      if (!saved.ok) return setError(saved.error);
      setResult(saved);
      setAlerts(null);
      // El texto pegado no se conserva una vez guardado.
      setText("");
    });
  }

  if (result) {
    return (
      <section className="flex flex-col gap-3 rounded-lg border border-border p-4 text-sm">
        <p className="font-medium">Alertas guardadas.</p>
        <ul>
          <li>
            {result.inserted} {result.inserted === 1 ? "movimiento nuevo" : "movimientos nuevos"}
          </li>
          {result.duplicates > 0 && <li>{result.duplicates} ya estaban guardados</li>}
          {result.alreadyInStatement > 0 && <li>{result.alreadyInStatement} ya estaban en un extracto importado</li>}
          {result.categorized > 0 && <li>{result.categorized} gastos categorizados</li>}
        </ul>
        <div className="flex gap-4">
          <Link href="/movimientos" className="text-accent underline">
            Ver movimientos
          </Link>
          <button onClick={() => setResult(undefined)} className="text-muted underline">
            Pegar más alertas
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Alertas</span>
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setAlerts(null);
          }}
          rows={6}
          placeholder="Bancolombia: Compraste $25.000,00 en … con tu T.Deb *1234, el 20/10/2026 a las 12:30."
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-base"
        />
      </label>
      <FormError message={error} />
      {!alerts && (
        <Button onClick={read} disabled={!text.trim()}>
          Leer alertas
        </Button>
      )}

      {alerts && (
        <>
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border text-sm">
            {alerts.map((alert, i) => {
              const ownTransfer = isOwnTransfer(alert, own);
              const incoming = alert.kind === "transfer_in";
              return (
                <li key={i} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 px-4 py-2">
                  <span className="min-w-0 truncate">{describe(alert)}</span>
                  <span className={`text-right tabular-nums ${ownTransfer ? "text-muted" : incoming ? "text-accent" : ""}`}>
                    {incoming ? "+" : "−"}
                    {formatCop(alert.amountCop)}
                  </span>
                  <span className="col-span-2 text-xs text-muted">
                    {alert.date}
                    {alert.time ? ` ${alert.time}` : ""} · {ownTransfer ? "Entre mis cuentas" : LABELS[alert.kind]}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-muted">
            Lo que va a tus propias cuentas (según Mis datos) no cuenta como gasto. Cuando importes el extracto de este
            periodo, estas alertas se reemplazan por sus movimientos del extracto.
          </p>
          <div className="flex gap-3">
            <Button onClick={save} disabled={saving}>
              {saving ? "Guardando…" : `Guardar ${alerts.length} ${alerts.length === 1 ? "alerta" : "alertas"}`}
            </Button>
            <Button variant="ghost" onClick={() => setAlerts(null)} disabled={saving}>
              Cancelar
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
