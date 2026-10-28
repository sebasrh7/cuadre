"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Button, Field, FormError, Input } from "@/components/ui";
import { classifyStatementMovement, type StatementKind } from "@/lib/movements/statement-classify";
import { matchesOwnName } from "@/lib/movements/own-transfer";
import { formatCop } from "@/lib/money/format";
import { centsToPesos } from "@/lib/parsers/amount";
import { parseBancolombiaStatement, type Statement, type StatementProblem } from "@/lib/parsers/bancolombia-statement";
import { extractTextItems } from "@/lib/pdf/extract-text-items";
import { importStatement, type ImportResult } from "./actions";

const PROBLEMS: Record<StatementProblem, string> = {
  not_a_statement: "Este PDF no parece un extracto de cuenta de ahorros de Bancolombia.",
  missing_summary: "No encontramos el resumen del extracto (saldo anterior, abonos, cargos).",
  summary_mismatch: "El resumen del extracto no cuadra. No guardamos nada para no meter datos malos.",
  totals_mismatch: "Los movimientos leídos no suman lo que dice el resumen. No guardamos nada.",
  balance_mismatch: "Los saldos de los movimientos no encadenan. No guardamos nada.",
};

const KIND_LABELS: Record<StatementKind, string> = {
  foreign_income: "Ingreso del exterior",
  interest: "Intereses",
  wallet_transfer: "A Nequi",
  person_transfer: "Transferencia",
  expense: "Gasto",
  other_income: "Otro ingreso",
};

type Step =
  | { name: "pick"; error?: string; needsPassword?: boolean }
  | { name: "preview"; statement: Statement }
  | { name: "done"; result: Extract<ImportResult, { ok: true }> };

export function StatementImporter({ ownNames }: { ownNames: string[] }) {
  const [step, setStep] = useState<Step>({ name: "pick" });
  const [reading, setReading] = useState(false);

  // onSubmit y no `action`: React reinicia los formularios con action al
  // terminar, y el usuario perdería el archivo elegido si falta la contraseña.
  async function read(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const file = formData.get("file");
    const password = String(formData.get("password") ?? "") || undefined;
    if (!(file instanceof File) || file.size === 0) {
      setStep({ name: "pick", error: "Elige el PDF del extracto." });
      return;
    }

    setReading(true);
    try {
      const extracted = await extractTextItems(await file.arrayBuffer(), password);
      if (!extracted.ok) {
        setStep({
          name: "pick",
          needsPassword: extracted.reason !== "unreadable",
          error: {
            needs_password: "El PDF tiene contraseña. Escríbela y vuelve a intentar.",
            wrong_password: "La contraseña no es correcta.",
            unreadable: "No pudimos leer el PDF.",
          }[extracted.reason],
        });
        return;
      }
      const parsed = parseBancolombiaStatement(extracted.items);
      setStep(parsed.ok ? { name: "preview", statement: parsed.statement } : { name: "pick", error: PROBLEMS[parsed.problem] });
    } finally {
      setReading(false);
    }
  }

  if (step.name === "done") return <Done result={step.result} onAgain={() => setStep({ name: "pick" })} />;
  if (step.name === "preview") {
    return (
      <Preview
        statement={step.statement}
        ownNames={ownNames}
        onCancel={() => setStep({ name: "pick" })}
        onSaved={(result) => setStep({ name: "done", result })}
      />
    );
  }

  return (
    <form onSubmit={read} className="flex flex-col gap-4 rounded-lg border border-border p-4">
      <Field label="Extracto (PDF)">
        <Input name="file" type="file" accept="application/pdf" required />
      </Field>
      <Field
        label="Contraseña del PDF"
        hint="Bancolombia suele usar tu número de documento. Solo se usa en tu navegador."
      >
        <Input name="password" type="password" autoComplete="off" autoFocus={step.needsPassword} />
      </Field>
      <FormError message={step.error} />
      <Button disabled={reading}>{reading ? "Leyendo…" : "Leer extracto"}</Button>
    </form>
  );
}

function Preview({
  statement,
  ownNames,
  onCancel,
  onSaved,
}: {
  statement: Statement;
  ownNames: string[];
  onCancel: () => void;
  onSaved: (result: Extract<ImportResult, { ok: true }>) => void;
}) {
  const classified = useMemo(
    () => statement.movements.map((m) => ({ ...m, ...classifyStatementMovement(m) })),
    [statement],
  );

  const personNames = useMemo(
    () => [...new Set(classified.filter((m) => m.kind === "person_transfer").map((m) => m.counterparty ?? ""))].filter(Boolean),
    [classified],
  );

  const [nequiIsOwn, setNequiIsOwn] = useState(true);
  const [ownPersonNames, setOwnPersonNames] = useState(
    () => new Set(personNames.filter((n) => matchesOwnName(n, ownNames))),
  );
  const [error, setError] = useState<string>();
  const [saving, startSaving] = useTransition();

  const sum = (kind: StatementKind) =>
    centsToPesos(Math.abs(classified.filter((m) => m.kind === kind).reduce((t, m) => t + m.amountCents, 0)));
  const count = (kind: StatementKind) => classified.filter((m) => m.kind === kind).length;

  function save() {
    startSaving(async () => {
      const result = await importStatement({
        statement,
        decisions: { nequiIsOwn, ownPersonNames: [...ownPersonNames] },
      });
      if (result.ok) onSaved(result);
      else setError(result.error);
    });
  }

  return (
    <section className="flex flex-col gap-6">
      <p className="rounded-lg border border-accent p-4 text-sm">
        <strong className="text-accent">✓ El extracto cuadra.</strong> {statement.movements.length} movimientos del{" "}
        {statement.from} al {statement.to}, cuenta de ahorros *{statement.accountLast4}. El resumen, los totales y
        los saldos coinciden.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <Stat label={`Ingresos del exterior (${count("foreign_income")})`} value={formatCop(sum("foreign_income"))} />
        <Stat label={`Gastos (${count("expense")})`} value={formatCop(sum("expense"))} />
        <Stat label={`Transferencias (${count("person_transfer") + count("wallet_transfer")})`} value={formatCop(sum("person_transfer") + sum("wallet_transfer"))} />
        <Stat label={`Intereses (${count("interest")} abonos, se guardan por mes)`} value={formatCop(sum("interest"))} />
      </div>

      {(count("wallet_transfer") > 0 || personNames.length > 0) && (
        <fieldset className="min-w-0 flex flex-col gap-3 rounded-lg border border-border p-4 text-sm">
          <legend className="px-1 font-semibold">¿Cuáles van a tus propias cuentas?</legend>
          <p className="text-muted">Lo que marques no cuenta como gasto: es plata que mueves entre tus cuentas.</p>
          {count("wallet_transfer") > 0 && (
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={nequiIsOwn} onChange={(e) => setNequiIsOwn(e.target.checked)} />
              {count("wallet_transfer")} envíos a Nequi ({formatCop(sum("wallet_transfer"))}) son a mi Nequi
            </label>
          )}
          {personNames.map((name) => (
            <label key={name} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={ownPersonNames.has(name)}
                onChange={(e) => {
                  const next = new Set(ownPersonNames);
                  if (e.target.checked) next.add(name);
                  else next.delete(name);
                  setOwnPersonNames(next);
                }}
              />
              Transferencias a {name} son mías
            </label>
          ))}
        </fieldset>
      )}

      <details className="rounded-lg border border-border p-4 text-sm">
        <summary className="cursor-pointer font-medium">Ver los {classified.length} movimientos</summary>
        <ul className="mt-3 flex flex-col divide-y divide-border">
          {classified.map((m, i) => (
            <li key={i} className="flex flex-wrap gap-x-3 py-2">
              <span className="text-muted tabular-nums">{m.date}</span>
              <span className="flex-1">{m.counterparty ?? m.description}</span>
              <span className="text-muted">{KIND_LABELS[m.kind]}</span>
              <span className={`tabular-nums ${m.amountCents > 0 ? "text-accent" : ""}`}>
                {m.amountCents > 0 ? "+" : "−"}
                {formatCop(centsToPesos(Math.abs(m.amountCents)))}
              </span>
            </li>
          ))}
        </ul>
      </details>

      <FormError message={error} />
      <div className="flex gap-3">
        <Button onClick={save} disabled={saving}>
          {saving ? "Guardando…" : "Guardar movimientos"}
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
      </div>
    </section>
  );
}

function Done({ result, onAgain }: { result: Extract<ImportResult, { ok: true }>; onAgain: () => void }) {
  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border p-4">
      <p className="font-medium">Extracto importado.</p>
      <ul className="text-sm">
        <li>{plural(result.inserted, "movimiento nuevo", "movimientos nuevos")}</li>
        {result.duplicates > 0 && (
          <li>{plural(result.duplicates, "ya estaba guardado y se omitió", "ya estaban guardados y se omitieron")}</li>
        )}
        {result.replacedAlerts > 0 && (
          <li>{plural(result.replacedAlerts, "alerta reemplazada por el extracto", "alertas reemplazadas por el extracto")}</li>
        )}
        {result.categorized > 0 && <li>{plural(result.categorized, "gasto categorizado", "gastos categorizados")}</li>}
        {result.uncategorized > 0 && (
          <li>{plural(result.uncategorized, "gasto quedó sin categoría", "gastos quedaron sin categoría")}: puedes asignarla en Movimientos</li>
        )}
        <li>
          {result.linkedIncomes > 0
            ? `${plural(result.linkedIncomes, "ingreso en USD enlazado", "ingresos en USD enlazados")} con su abono en pesos`
            : "Ningún ingreso en USD se enlazó: regístralos en Ingresos USD para ver tu tasa efectiva"}
        </li>
      </ul>
      <div className="flex gap-4 text-sm">
        <Link href="/movimientos" className="text-accent underline">
          Ver movimientos
        </Link>
        <button onClick={onAgain} className="text-muted underline">
          Importar otro extracto
        </button>
      </div>
    </section>
  );
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}
