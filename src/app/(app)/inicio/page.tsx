import Link from "next/link";
import { Suspense } from "react";
import { requireConsentedUser } from "@/lib/auth";
import { headers } from "next/headers";
import { calendarUrls } from "@/lib/dates/calendar-url";
import { pilaBusinessDay, upcomingPilaDues } from "@/lib/dates/pila";
import { DeadlinesCard, ExpensesCard, IncomeSection, RentaCard, SocialSecurityCard, Sources, monthName } from "./cards";
import { loadTaxRules } from "@/lib/tax/load";
import { checkRenta, unmeasuredRentaThresholds } from "@/lib/tax/renta";
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
  const [{ data: movements }, taxRules, { data: pilaRules }] = await Promise.all([
    supabase
      .from("movements")
      .select("occurred_on, amount_cop, direction, kind, category")
      .gte("occurred_on", `${year}-01-01`)
      .lte("occurred_on", `${year}-12-31`),
    loadTaxRules(supabase, year),
    supabase.from("pila_deadlines").select("digits_from, digits_to, business_day"),
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
  const incomeByMonth = months.map((month) => ({
    month,
    income: movements
      .filter((m) => m.kind === "income" && m.occurred_on.startsWith(month))
      .reduce((t, m) => t + m.amount_cop, 0),
  }));
  const incomeYtd = incomeByMonth.reduce((t, m) => t + m.income, 0);
  const depositsYtd = movements.filter((m) => m.direction === "in").reduce((t, m) => t + m.amount_cop, 0);
  const lastMonth = incomeByMonth.at(-1)!;

  return (
    <div className="flex flex-col gap-8">
      <IncomeSection year={year} incomeByMonth={incomeByMonth} />

      {nextPila && (
        <DeadlinesCard
          due={nextPila}
          periodIncome={incomeByMonth.find((m) => m.month === nextPila.periodMonth)?.income ?? null}
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
          <SocialSecurityCard
            monthLabel={monthName(lastMonth.month)}
            income={lastMonth.income}
            arlRisk={(profile.arl_risk ?? 1) as 1 | 2 | 3 | 4 | 5}
            rules={taxRules.rules}
            months={incomeByMonth.map((m) => ({ label: monthName(m.month), income: m.income }))}
          />
          <RentaCard
            year={year}
            checks={checkRenta({ incomeYtd, depositsYtd, monthsWithData: months.length }, taxRules.rules)}
            unmeasured={unmeasuredRentaThresholds(taxRules.rules)}
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

