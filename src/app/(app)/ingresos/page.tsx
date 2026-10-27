import { connection } from "next/server";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { effectiveRate, formatCop, formatRate, formatUsd } from "@/lib/money/format";
import { deleteForeignIncome } from "./actions";
import { IncomeForm } from "./income-form";

export default function IncomesPage() {
  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold">Monto en USD (opcional)</h1>
        <p className="text-sm text-muted">
          Solo si sabes cuántos dólares te pagaron. Tus ingresos en pesos ya salen del extracto; con
          el monto en USD calculamos la tasa a la que recibiste cada pago.
        </p>
      </div>
      <Suspense fallback={<p className="text-muted">Cargando…</p>}>
        <Form />
      </Suspense>
      <Suspense fallback={<p className="text-muted">Cargando ingresos…</p>}>
        <IncomeList />
      </Suspense>
    </>
  );
}

async function Form() {
  // La fecha de hoy depende de la petición, no del momento del build.
  await connection();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
  return <IncomeForm today={today} />;
}

async function IncomeList() {
  const { supabase } = await requireUser();
  const { data: incomes, error } = await supabase
    .from("foreign_incomes")
    .select("id, received_on, amount_minor, payer, movements(amount_cop)")
    .order("received_on", { ascending: false })
    .limit(50);

  if (error) return <p className="text-danger">No pudimos cargar tus ingresos.</p>;
  if (!incomes?.length) return <p className="text-muted">Todavía no has registrado ingresos.</p>;

  return (
    <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
      {incomes.map((income) => {
        const cop = income.movements?.amount_cop;
        return (
          <li key={income.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 p-4 text-sm">
            <span className="text-muted tabular-nums">{income.received_on}</span>
            <span className="font-medium tabular-nums">{formatUsd(income.amount_minor)}</span>
            {cop ? (
              <span className="tabular-nums">
                {formatCop(cop)} · tasa {formatRate(effectiveRate(cop, income.amount_minor))}
              </span>
            ) : (
              <span className="text-muted">Sin abono en COP</span>
            )}
            {income.payer && <span className="text-muted">{income.payer}</span>}
            <form action={deleteForeignIncome} className="ml-auto">
              <input type="hidden" name="id" value={income.id} />
              <button className="text-muted hover:text-danger">Borrar</button>
            </form>
          </li>
        );
      })}
    </ul>
  );
}
