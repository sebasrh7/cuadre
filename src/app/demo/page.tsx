import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import {
  DeadlinesCard,
  ExpensesCard,
  IncomeSection,
  RentaCard,
  SocialSecurityCard,
  monthName,
} from "@/app/(app)/inicio/cards";
import { calendarUrls } from "@/lib/dates/calendar-url";
import { upcomingPilaDues } from "@/lib/dates/pila";
import { rules2026Rows } from "@/lib/tax/__fixtures__/rules-2026";
import { checkRenta, unmeasuredRentaThresholds } from "@/lib/tax/renta";
import { buildTaxRules } from "@/lib/tax/rules";
import { estimateSocialSecurity } from "@/lib/tax/social-security";

/**
 * Inicio con datos INVENTADOS, solo en desarrollo, para las capturas del
 * README. En producción no existe.
 */
export default function DemoPage() {
  return (
    <Suspense>
      <Demo />
    </Suspense>
  );
}

const incomeByMonth = [
  ["2026-01", 2_400_000],
  ["2026-02", 1_600_000],
  ["2026-03", 2_400_000],
  ["2026-04", 1_600_000],
  ["2026-05", 2_400_000],
  ["2026-06", 1_600_000],
  ["2026-07", 2_400_000],
  ["2026-08", 1_600_000],
  ["2026-09", 2_400_000],
].map(([month, income]) => ({ month: month as string, income: income as number }));

const expenseTotals: [string | null, number][] = [
  ["Mercado", 4_120_000],
  ["Transporte", 2_310_000],
  ["Servicios públicos", 1_480_000],
  ["Restaurantes y domicilios", 1_150_000],
  ["Suscripciones", 420_000],
  ["Entretenimiento", 310_000],
  [null, 95_000],
];

async function Demo() {
  if (process.env.NODE_ENV !== "development") notFound();
  await connection();

  const rules = buildTaxRules(rules2026Rows);
  const today = "2026-10-28";
  const due = upcomingPilaDues(today, 3, 1)[0];
  const incomeYtd = incomeByMonth.reduce((t, m) => t + m.income, 0);
  const expenses = expenseTotals.map(([category, amount]) => ({
    occurred_on: "2026-09-15",
    amount_cop: amount,
    category,
  }));

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border">
        <nav className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
          <span className="text-base font-semibold">Cuadre</span>
          <span>Movimientos</span>
          <span>Mi cuenta</span>
          <span className="ml-auto rounded bg-accent px-2 py-0.5 text-xs text-white dark:text-black">Datos de ejemplo</span>
        </nav>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
        <h1 className="text-2xl font-semibold">Inicio</h1>
        <div className="flex flex-col gap-8">
          <IncomeSection year={2026} incomeByMonth={incomeByMonth} />
          <DeadlinesCard
            due={due}
            periodIncome={incomeByMonth.find((m) => m.month === due.periodMonth)?.income ?? 2_400_000}
            estimate={(income) => estimateSocialSecurity(income, 1, rules)}
            calendar={calendarUrls("https://cuadre.example", "00000000-0000-4000-8000-000000000000")}
            today={today}
          />
          <ExpensesCard expenses={expenses} lastMonth="2026-09" lastMonthLabel="Sept" />
          <SocialSecurityCard
            monthLabel={monthName("2026-09")}
            income={2_400_000}
            arlRisk={1}
            rules={rules}
            months={incomeByMonth.slice(-3).map((m) => ({ label: monthName(m.month), income: m.income }))}
          />
          <RentaCard
            year={2026}
            checks={checkRenta({ incomeYtd, depositsYtd: incomeYtd + 3_000_000, monthsWithData: 9 }, rules)}
            unmeasured={unmeasuredRentaThresholds(rules)}
            uvt={rules.uvt}
          />
        </div>
      </main>
    </div>
  );
}
