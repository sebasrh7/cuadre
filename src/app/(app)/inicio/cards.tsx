import Link from "next/link";
import { UNCATEGORIZED } from "@/lib/categories/categories";
import type { calendarUrls } from "@/lib/dates/calendar-url";
import { formatCop } from "@/lib/money/format";
import type { RentaCheck } from "@/lib/tax/renta";
import { estimateSocialSecurity } from "@/lib/tax/social-security";

// Tarjetas de Inicio: solo presentación, sin acceso a datos. Las usa también
// la página de demostración (con datos inventados) para las capturas del README.

export function IncomeSection({ year, incomeByMonth }: { year: number; incomeByMonth: { month: string; income: number }[] }) {
  const months = incomeByMonth.map((m) => m.month);
  const incomeYtd = incomeByMonth.reduce((t, m) => t + m.income, 0);
  const maxIncome = Math.max(...incomeByMonth.map((m) => m.income), 1);
  return (
    <section className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Stat label={`Ingresos ${year} (${months.length} ${months.length === 1 ? "mes" : "meses"} con datos)`} value={formatCop(incomeYtd)} />
        <Stat label="Promedio mensual" value={formatCop(Math.round(incomeYtd / months.length))} />
      </div>
      <ul className="flex flex-col gap-1 text-sm">
        {incomeByMonth.map(({ month, income }) => (
          <li key={month} className="grid grid-cols-[6rem_1fr_7rem] items-center gap-3">
            <span className="text-muted">{monthName(month)}</span>
            <span className="h-2 rounded bg-accent" style={{ width: `${(income / maxIncome) * 100}%` }} />
            <span className="text-right tabular-nums">{formatCop(income)}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted">
        Ingresos = lo que entra a tus cuentas sin contar transferencias entre ellas.{" "}
        <Link href="/importar" className="underline">
          Importar otro extracto
        </Link>
      </p>
    </section>
  );
}

export function DeadlinesCard({
  due,
  periodIncome,
  estimate,
  calendar,
  today,
}: {
  due: { periodMonth: string; dueDate: string };
  periodIncome: number | null;
  estimate: ((income: number) => ReturnType<typeof estimateSocialSecurity>) | null;
  calendar: ReturnType<typeof calendarUrls>;
  today: string;
}) {
  const days = Math.round((Date.parse(due.dueDate) - Date.parse(today)) / 86_400_000);
  const period = monthName(due.periodMonth).toLowerCase();
  const ss = periodIncome !== null && estimate ? estimate(periodIncome) : null;
  const dueLabel = new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(
    new Date(`${due.dueDate}T00:00:00Z`),
  );

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-accent p-4">
      <h2 className="font-semibold">Próxima fecha</h2>
      <p>
        <strong>PILA de {period}</strong>: vence el {dueLabel}{" "}
        <span className="text-muted">({days === 0 ? "hoy" : days === 1 ? "mañana" : `en ${days} días`})</span>.
      </p>
      <p className="text-sm text-muted">
        {ss === null
          ? `Importa el extracto con tus movimientos de ${period} para ver si te toca pagar y cuánto.`
          : ss.obligated
            ? `Según tus ingresos de ${period} (${formatCop(periodIncome!)}), el aporte estimado es ${formatCop(ss.total)}.`
            : `En ${period} recibiste ${formatCop(periodIncome!)}, menos de 1 salario mínimo: no estás obligado a pagar ese mes.`}
      </p>
      <div className="flex flex-wrap gap-3 text-sm">
        <a href={calendar.google} target="_blank" rel="noreferrer" className="text-accent underline">
          Recibir los avisos en Google Calendar
        </a>
        <a href={calendar.webcal} className="text-muted underline">
          Otro calendario (iPhone, Outlook)
        </a>
      </div>
      <p className="text-xs text-muted">
        El calendario trae las fechas de la PILA de los próximos 12 meses, con aviso 2 días antes. No incluye montos.
        Las fechas de la declaración de renta de {Number(today.slice(0, 4)) + 1} se agregarán cuando la DIAN publique el
        calendario tributario.
      </p>
    </section>
  );
}

export function ExpensesCard({
  expenses,
  lastMonth,
  lastMonthLabel,
}: {
  expenses: { occurred_on: string; amount_cop: number; category: string | null }[];
  lastMonth: string;
  lastMonthLabel: string;
}) {
  if (!expenses.length) return null;

  const byCategory = (rows: typeof expenses) => {
    const totals = new Map<string, number>();
    for (const e of rows) {
      const category = e.category ?? UNCATEGORIZED;
      totals.set(category, (totals.get(category) ?? 0) + e.amount_cop);
    }
    return [...totals].sort((a, b) => b[1] - a[1]);
  };
  const year = byCategory(expenses);
  const month = new Map(byCategory(expenses.filter((e) => e.occurred_on.startsWith(lastMonth))));
  const yearTotal = year.reduce((t, [, v]) => t + v, 0);
  const max = year[0]?.[1] ?? 1;

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">Gastos por categoría</h2>
        <p className="text-sm text-muted tabular-nums">Año {formatCop(yearTotal)}</p>
      </div>
      <ul className="flex flex-col gap-2 text-sm">
        {year.map(([category, total]) => (
          <li key={category} className="flex flex-col gap-1">
            <div className="flex justify-between gap-2">
              <span className={category === UNCATEGORIZED ? "text-danger" : ""}>{category}</span>
              <span className="tabular-nums">
                {formatCop(total)}
                <span className="text-muted"> · {lastMonthLabel.toLowerCase()} {formatCop(month.get(category) ?? 0)}</span>
              </span>
            </div>
            <div className="h-1.5 rounded bg-border">
              <div className="h-full rounded bg-accent" style={{ width: `${(total / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
      {year.some(([c]) => c === UNCATEGORIZED) && (
        <Link href="/movimientos" className="self-start text-xs text-accent underline">
          Categorizar los gastos pendientes
        </Link>
      )}
    </section>
  );
}

export function SocialSecurityCard({
  monthLabel,
  income,
  arlRisk,
  rules,
  months,
}: {
  monthLabel: string;
  income: number;
  arlRisk: 1 | 2 | 3 | 4 | 5;
  rules: Parameters<typeof estimateSocialSecurity>[2];
  months: { label: string; income: number }[];
}) {
  const ss = estimateSocialSecurity(income, arlRisk, rules);
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <h2 className="font-semibold">Seguridad social de {monthLabel.toLowerCase()}</h2>
      {!ss.obligated ? (
        <p className="text-sm">
          Con {formatCop(income)} ese mes no superaste 1 salario mínimo ({formatCop(rules.smmlv)}): no estabas
          obligado a aportar como independiente.
        </p>
      ) : (
        <>
          <p className="text-3xl font-semibold tabular-nums">{formatCop(ss.total)}</p>
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted">Ingresos del mes</dt>
            <dd className="text-right tabular-nums">{formatCop(income)}</dd>
            <dt className="text-muted">Base de cotización (IBC)</dt>
            <dd className="text-right tabular-nums">{formatCop(ss.ibc)}</dd>
            <dt className="text-muted">Salud (12,5 %)</dt>
            <dd className="text-right tabular-nums">{formatCop(ss.health)}</dd>
            <dt className="text-muted">Pensión (16 %)</dt>
            <dd className="text-right tabular-nums">{formatCop(ss.pension)}</dd>
            <dt className="text-muted">ARL riesgo {arlRisk}</dt>
            <dd className="text-right tabular-nums">{formatCop(ss.arl)}</dd>
          </dl>
          <p className="text-xs text-muted">
            El IBC es el 40 % de lo que recibes en el mes ({formatCop(ss.ibcRaw)})
            {ss.ibcAtFloor ? `, pero nunca menos de 1 salario mínimo, así que se cotiza sobre ${formatCop(rules.smmlv)}` : ""}.
            Se paga mes vencido por la PILA. Es un estimado: tu operador de PILA puede redondear distinto.
          </p>
        </>
      )}
      {months.length > 1 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted">Mes a mes</summary>
          <ul className="mt-2 flex flex-col gap-1">
            {months.map((m) => {
              const month = estimateSocialSecurity(m.income, arlRisk, rules);
              return (
                <li key={m.label} className="grid grid-cols-[4rem_1fr_auto] gap-3 tabular-nums">
                  <span className="text-muted">{m.label}</span>
                  <span>{formatCop(m.income)}</span>
                  <span>{month.obligated ? formatCop(month.total) : "No obligado"}</span>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-xs text-muted">
            La obligación se mide mes a mes: aplica en los meses en que recibes 1 salario mínimo o más.
          </p>
        </details>
      )}
    </section>
  );
}

const STATUS: Record<RentaCheck["status"], { label: string; className: string }> = {
  exceeded: { label: "Ya pasaste el tope: te toca declarar", className: "text-danger" },
  likely: { label: "A este ritmo lo pasarás antes de fin de año", className: "text-danger" },
  close: { label: "Vas cerca del tope", className: "text-amber-600 dark:text-amber-400" },
  far: { label: "Lejos del tope", className: "text-accent" },
};

const CHECK_LABELS: Record<RentaCheck["key"], string> = {
  ingresos: "Ingresos brutos",
  consignaciones: "Consignaciones y depósitos (incluye transferencias propias)",
};

export function RentaCard({
  year,
  checks,
  unmeasured,
  uvt,
}: {
  year: number;
  checks: RentaCheck[];
  unmeasured: { label: string; threshold: number }[];
  uvt: number;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <h2 className="font-semibold">¿Te toca declarar renta por {year}?</h2>
      <p className="text-sm text-muted">
        Basta con pasar uno de los topes. La declaración se presenta en {year + 1}.
      </p>
      <ul className="flex flex-col gap-3 text-sm">
        {checks.map((c) => (
          <li key={c.key} className="flex flex-col gap-1">
            <div className="flex flex-wrap justify-between gap-2">
              <span>{CHECK_LABELS[c.key]}</span>
              <span className={`font-medium ${STATUS[c.status].className}`}>{STATUS[c.status].label}</span>
            </div>
            <div className="h-2 overflow-hidden rounded bg-border">
              <div
                className="h-full bg-accent"
                style={{ width: `${Math.min((c.actual / c.threshold) * 100, 100)}%` }}
              />
            </div>
            <p className="text-xs text-muted tabular-nums">
              Llevas {formatCop(c.actual)} · proyección del año {formatCop(c.projected)} · tope {formatCop(c.threshold)}
            </p>
          </li>
        ))}
      </ul>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted">Otros topes que debes revisar tú</summary>
        <ul className="mt-2 flex flex-col gap-1">
          {unmeasured.map((t) => (
            <li key={t.label} className="flex justify-between gap-2">
              <span>{t.label}</span>
              <span className="tabular-nums">{formatCop(t.threshold)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted">UVT {year}: {formatCop(uvt)}.</p>
      </details>
    </section>
  );
}

export function Sources({ sources }: { sources: { key: string; norm: string; url: string }[] }) {
  const unique = [...new Map(sources.map((s) => [s.url, s])).values()];
  return (
    <details className="text-xs text-muted">
      <summary className="cursor-pointer">Fuentes de estos cálculos</summary>
      <ul className="mt-2 flex flex-col gap-1">
        {unique.map((s) => (
          <li key={s.url}>
            <a href={s.url} target="_blank" rel="noreferrer" className="underline">
              {s.norm}
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-2">Cuadre no es asesoría tributaria. Confirma con un contador antes de decidir.</p>
    </details>
  );
}

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export function monthName(month: string): string {
  const label = new Intl.DateTimeFormat("es-CO", { month: "short", timeZone: "UTC" }).format(
    new Date(`${month}-01T00:00:00Z`),
  );
  return label.charAt(0).toUpperCase() + label.slice(1).replace(".", "");
}
