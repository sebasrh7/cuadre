import Link from "next/link";
import { Suspense } from "react";
import { requireConsentedUser } from "@/lib/auth";
import { formatCop } from "@/lib/money/format";
import { loadTaxRules } from "@/lib/tax/load";
import { ASSET_KINDS, patrimonioTotal } from "@/lib/tax/patrimonio";
import { deleteAsset } from "./actions";
import { AssetForm, BalanceForm } from "./patrimonio-forms";

const INSTITUTIONS: Record<string, string> = { bancolombia: "Bancolombia", nequi: "Nequi", nu: "Nu", other: "Otra" };
const ACCOUNT_KINDS: Record<string, string> = { savings: "ahorros", checking: "corriente", wallet: "billetera", debit_card: "débito" };

export default function PatrimonioPage() {
  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold">Patrimonio</h1>
        <p className="text-sm text-muted">
          Lo que tienes a tu nombre: saldos de tus cuentas y bienes. Se usa solo para saber si pasas el tope de
          patrimonio para declarar renta (se mide al 31 de diciembre). Las deudas no se restan: el tope es sobre el
          patrimonio bruto.
        </p>
      </div>
      <Suspense fallback={<p className="text-muted">Cargando…</p>}>
        <Patrimonio />
      </Suspense>
    </>
  );
}

async function Patrimonio() {
  const { supabase } = await requireConsentedUser();
  const year = Number(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric" }).format(new Date()));
  const [{ data: accounts }, { data: assets }, taxRules] = await Promise.all([
    supabase.from("own_accounts").select("id, institution, kind, last4, balance_cop, balance_on").neq("kind", "credit_card"),
    supabase.from("assets").select("id, kind, label, value_cop").order("created_at"),
    loadTaxRules(supabase, year),
  ]);

  const total = patrimonioTotal(
    (accounts ?? []).map((a) => ({ kind: a.kind, balanceCop: a.balance_cop })),
    (assets ?? []).map((a) => ({ valueCop: a.value_cop })),
  );
  const threshold = taxRules ? taxRules.rules.renta.patrimonioUvt * taxRules.rules.uvt : null;

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-1 rounded-lg border border-border p-4">
        <p className="text-sm text-muted">Total que conoce la app</p>
        <p className="text-3xl font-semibold tabular-nums">{total === null ? "—" : formatCop(total)}</p>
        {threshold !== null && (
          <p className="text-sm text-muted">
            Tope para declarar renta por {year}: {formatCop(threshold)}.{" "}
            {total !== null && (total >= threshold ? "Lo pasas: te toca declarar." : "Estás por debajo.")}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Saldos de tus cuentas</h2>
        <p className="text-sm text-muted">
          Al importar un extracto se guarda su saldo de cierre. Si una cuenta no tiene extracto reciente, escribe su
          saldo de hoy.
        </p>
        {accounts?.length ? (
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border text-sm">
            {accounts.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                <span>
                  {INSTITUTIONS[a.institution] ?? a.institution} {ACCOUNT_KINDS[a.kind] ?? a.kind} *{a.last4}
                </span>
                <span className="tabular-nums">
                  {a.balance_cop === null ? (
                    <span className="text-muted">sin saldo</span>
                  ) : (
                    <>
                      {formatCop(a.balance_cop)} <span className="text-xs text-muted">al {a.balance_on}</span>
                    </>
                  )}
                </span>
                <BalanceForm accountId={a.id} current={a.balance_cop} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">
            Todavía no hay cuentas. <Link href="/importar" className="text-accent underline">Importa un extracto</Link>.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Bienes</h2>
        {assets?.length ? (
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border text-sm">
            {assets.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                <span>
                  {a.label || ASSET_KINDS[a.kind as keyof typeof ASSET_KINDS] || a.kind}
                  {a.label && <span className="text-muted"> · {ASSET_KINDS[a.kind as keyof typeof ASSET_KINDS]}</span>}
                </span>
                <span className="ml-auto tabular-nums">{formatCop(a.value_cop)}</span>
                <form action={deleteAsset}>
                  <input type="hidden" name="id" value={a.id} />
                  <button className="text-muted hover:text-danger">Borrar</button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Sin bienes registrados. Si no tienes casa, carro, moto ni inversiones, déjalo así.</p>
        )}
        <AssetForm />
      </section>
    </div>
  );
}
