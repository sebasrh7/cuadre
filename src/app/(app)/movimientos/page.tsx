import Link from "next/link";
import { Suspense } from "react";
import { requireConsentedUser } from "@/lib/auth";
import { formatCop } from "@/lib/money/format";
import { CategorizeButton, CategorySelect } from "./category-controls";

const KIND_LABELS = { income: "Ingreso", expense: "Gasto", own_transfer: "Entre mis cuentas" } as const;

export default function MovementsPage() {
  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold">Movimientos</h1>
        <Link href="/importar" className="text-sm text-accent underline">
          Importar extracto
        </Link>
      </div>
      <Suspense fallback={<p className="text-muted">Cargando…</p>}>
        <MovementList />
      </Suspense>
    </>
  );
}

async function MovementList() {
  const { supabase } = await requireConsentedUser();
  const { data, error } = await supabase
    .from("movements")
    .select("id, occurred_on, amount_cop, direction, kind, counterparty, category")
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) return <p className="text-danger">No pudimos cargar tus movimientos.</p>;
  if (!data.length) {
    return (
      <p className="text-muted">
        Todavía no hay movimientos. <Link href="/importar" className="text-accent underline">Importa tu extracto</Link>.
      </p>
    );
  }

  const months = Map.groupBy(data, (m) => m.occurred_on.slice(0, 7));
  const uncategorized = data.filter((m) => m.kind === "expense" && !m.category && m.counterparty).length;

  return (
    <div className="flex flex-col gap-6">
      <CategorizeButton uncategorized={uncategorized} />
      {[...months].map(([month, movements]) => {
        const total = (kind: string) =>
          movements.filter((m) => m.kind === kind).reduce((t, m) => t + m.amount_cop, 0);
        return (
          <section key={month} className="flex flex-col gap-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-semibold">{monthName(month)}</h2>
              <p className="text-sm text-muted tabular-nums">
                Ingresos {formatCop(total("income"))} · Gastos {formatCop(total("expense"))}
              </p>
            </div>
            <ul className="flex flex-col divide-y divide-border rounded-lg border border-border text-sm">
              {movements.map((m) => (
                // En el celular, dos líneas: comercio y monto arriba; día y categoría abajo.
                <li
                  key={m.id}
                  className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 px-4 py-2 sm:grid-cols-[2rem_1fr_auto_auto]"
                >
                  <span className="hidden text-muted tabular-nums sm:inline">{m.occurred_on.slice(8)}</span>
                  <span className="min-w-0 truncate">{m.counterparty ?? "—"}</span>
                  <span
                    className={`text-right tabular-nums sm:order-last ${m.kind === "own_transfer" ? "text-muted" : m.direction === "in" ? "text-accent" : ""}`}
                  >
                    {m.direction === "in" ? "+" : "−"}
                    {formatCop(m.amount_cop)}
                  </span>
                  <span className="col-span-2 flex min-w-0 items-center gap-2 text-xs sm:col-span-1">
                    <span className="text-muted tabular-nums sm:hidden">Día {Number(m.occurred_on.slice(8))} ·</span>
                    {m.kind === "expense" && m.counterparty ? (
                      // La key lo vuelve a montar cuando la categoría cambia en el servidor.
                      <CategorySelect key={m.category ?? ""} counterparty={m.counterparty} category={m.category} />
                    ) : (
                      <span className="text-muted">{m.category ?? KIND_LABELS[m.kind as keyof typeof KIND_LABELS]}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function monthName(month: string): string {
  const label = new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${month}-01T00:00:00Z`),
  );
  return label.charAt(0).toUpperCase() + label.slice(1);
}
