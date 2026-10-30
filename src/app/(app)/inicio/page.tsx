import Link from "next/link";
import { Suspense } from "react";
import { requireConsentedUser } from "@/lib/auth";
import { headers } from "next/headers";
import { calendarUrls } from "@/lib/dates/calendar-url";
import { pilaBusinessDay, upcomingPilaDues } from "@/lib/dates/pila";
import { DeadlinesCard, ExpensesCard, IncomeSection, RentaCard, SocialSecurityCard, Sources, monthName } from "./cards";
import { DeclareIncomeForm } from "./declare-income-form";
import { DECLARED_INCOME_CATEGORY, suggestedIncome } from "@/lib/movements/declared-income";
import { TRANSFER_CATEGORY } from "@/lib/movements/statement-import";
import { loadTaxRules } from "@/lib/tax/load";
import { checkRenta, unmeasuredRentaThresholds } from "@/lib/tax/renta";
import { patrimonioTotal } from "@/lib/tax/patrimonio";
import { estimateSocialSecurity } from "@/lib/tax/social-security";

export default function HomePage() {
  return (
    <>
      <h1 className="text-2xl font-semibold">Inicio</h1>
      <Suspense fallback={<p className="text-muted">Cargando…</p>}>
        <Dashboard />
      </Suspense>
    </>
  );
}

async function Dashboard() {
  const { supabase, profile } = await requireConsentedUser();

  const year = Number(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric" }).format(new Date()));
  const [{ data: movements }, taxRules, { data: pilaRules }, { data: accounts }, { data: assets }] = await Promise.all([
    supabase
      .from("movements")
      .select("occurred_on, amount_cop, direction, kind, category, source, account_last4")
      .gte("occurred_on", `${year}-01-01`)
      .lte("occurred_on", `${year}-12-31`),
    loadTaxRules(supabase, year),
    supabase.from("pila_deadlines").select("digits_from, digits_to, business_day"),
    supabase.from("own_accounts").select("kind, last4, balance_cop"),
    supabase.from("assets").select("value_cop"),
  ]);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
  const host = (await headers()).get("host");
  const origin = host ? `${host.startsWith("localhost") ? "http" : "https"}://${host}` : "";
  const nextPila =
    pilaRules?.length && profile.id_last_two !== null
      ? upcomingPilaDues(today, pilaBusinessDay(profile.id_last_two, pilaRules), 1)[0]
      : null;

  if (!movements?.length) {
    return (
      <p className="text-muted">
        Todavía no hay movimientos de {year}.{" "}
        <Link href="/importar" className="text-accent underline">
          Importa tu extracto
        </Link>{" "}
        para ver tus ingresos, tus aportes y si te toca declarar renta.
      </p>
    );
  }

  const months = [...new Set(movements.map((m) => m.occurred_on.slice(0, 7)))].sort();
  // Un mes sin extracto (solo alertas o registros a mano) está incompleto: las alertas no traen
  // todos los ingresos. No cuenta para promedios ni para decir si toca aportar.
  const statementMonths = new Set(movements.filter((m) => m.source === "statement").map((m) => m.occurred_on.slice(0, 7)));
  // Lo que el usuario declaró para un mes sin extracto cuenta como dato del mes hasta que llegue el extracto.
  const declaredMonths = new Map(
    movements
      .filter((m) => m.source === "manual" && m.category === DECLARED_INCOME_CATEGORY)
      .map((m) => [m.occurred_on.slice(0, 7), m.amount_cop]),
  );
  const incomeByMonth = months.map((month) => ({
    month,
    income: movements
      .filter((m) => m.kind === "income" && m.occurred_on.startsWith(month))
      .reduce((t, m) => t + m.amount_cop, 0),
    complete: statementMonths.has(month) || declaredMonths.has(month),
    declared: !statementMonths.has(month) && declaredMonths.has(month),
  }));
  const incomeYtd = incomeByMonth.reduce((t, m) => t + m.income, 0);
  const depositsYtd = movements.filter((m) => m.direction === "in").reduce((t, m) => t + m.amount_cop, 0);
  const lastMonth = incomeByMonth.at(-1)!;
  const completeMonths = incomeByMonth.filter((m) => m.complete);
  const unclassified = movements.filter((m) => m.kind === "received").reduce((t, m) => t + m.amount_cop, 0);
  const expenses = movements.filter((m) => m.kind === "expense");
  // Compras y consumos: los gastos menos lo enviado a personas (puede no ser un consumo).
  const purchasesYtd = expenses.filter((m) => m.category !== TRANSFER_CATEGORY).reduce((t, m) => t + m.amount_cop, 0);
  const cardLast4 = new Set((accounts ?? []).filter((a) => a.kind === "credit_card").map((a) => a.last4));
  const creditCardYtd = cardLast4.size
    ? expenses.filter((m) => m.account_last4 && cardLast4.has(m.account_last4)).reduce((t, m) => t + m.amount_cop, 0)
    : undefined;
  const patrimonio = patrimonioTotal(
    (accounts ?? []).map((a) => ({ kind: a.kind, balanceCop: a.balance_cop })),
    (assets ?? []).map((a) => ({ valueCop: a.value_cop })),
  );
  const lastCompleteMonth = completeMonths.at(-1);
  const suggestion = suggestedIncome(incomeByMonth.filter((m) => m.complete && !m.declared).map((m) => m.income));
  const pilaMonth = nextPila ? incomeByMonth.find((m) => m.month === nextPila.periodMonth) : undefined;

  const rentaChecks = taxRules
    ? checkRenta(
        {
          incomeYtd,
          depositsYtd,
          monthsWithData: completeMonths.length || months.length,
          purchasesYtd,
          creditCardYtd,
          patrimonio: patrimonio ?? undefined,
        },
        taxRules.rules,
      )
    : [];

  return (
    <div className="flex flex-col gap-8">
      <IncomeSection year={year} incomeByMonth={incomeByMonth} unclassified={unclassified} />

      {nextPila && (
        <DeadlinesCard
          due={nextPila}
          periodIncome={pilaMonth?.complete ? pilaMonth.income : null}
          periodDeclared={pilaMonth?.declared ?? false}
          declareForm={
            !pilaMonth?.complete || pilaMonth.declared ? (
              <DeclareIncomeForm
                month={nextPila.periodMonth}
                monthLabel={monthName(nextPila.periodMonth).toLowerCase()}
                suggestion={suggestion}
                current={declaredMonths.get(nextPila.periodMonth)}
              />
            ) : null
          }
          estimate={
            taxRules
              ? (income: number) =>
                  estimateSocialSecurity(income, (profile.arl_risk ?? 1) as 1 | 2 | 3 | 4 | 5, taxRules.rules)
              : null
          }
          calendar={calendarUrls(origin, profile.calendar_token)}
          today={today}
        />
      )}

      <ExpensesCard
        expenses={movements.filter((m) => m.kind === "expense")}
        lastMonth={lastMonth.month}
        lastMonthLabel={monthName(lastMonth.month)}
      />

      {taxRules ? (
        <>
          {taxRules.isFallback && (
            <p className="rounded-lg border border-border p-3 text-sm text-muted">
              Aún no tenemos los valores oficiales de {year}; usamos los de {taxRules.rules.year}.
            </p>
          )}
          {lastCompleteMonth && (
            <SocialSecurityCard
              monthLabel={monthName(lastCompleteMonth.month)}
              income={lastCompleteMonth.income}
              arlRisk={(profile.arl_risk ?? 1) as 1 | 2 | 3 | 4 | 5}
              rules={taxRules.rules}
              months={completeMonths.map((m) => ({ label: monthName(m.month), income: m.income }))}
            />
          )}
          <RentaCard
            year={year}
            checks={rentaChecks}
            unmeasured={unmeasuredRentaThresholds(
              taxRules.rules,
              rentaChecks.map((c) => c.key),
            )}
            uvt={taxRules.rules.uvt}
          />
          <Sources sources={taxRules.rules.sources} />
        </>
      ) : (
        <p className="text-sm text-muted">No pudimos cargar las reglas fiscales del año.</p>
      )}

      <p className="text-xs text-muted">
        ¿Te pagan en dólares y sabes el monto?{" "}
        <Link href="/ingresos" className="underline">
          Registra el monto en USD
        </Link>{" "}
        para ver la tasa a la que recibiste cada pago.
      </p>
    </div>
  );
}

