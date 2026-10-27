import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { formatCop, formatUsd } from "@/lib/money/format";

export default function HomePage() {
  return (
    <>
      <h1 className="text-2xl font-semibold">Inicio</h1>
      <Suspense fallback={<p className="text-muted">Cargando…</p>}>
        <Summary />
      </Suspense>
    </>
  );
}

async function Summary() {
  const { supabase, userId } = await requireUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarded_at")
    .eq("id", userId)
    .single();
  if (!profile?.onboarded_at) redirect("/onboarding");

  const year = new Date().getFullYear();
  const { data: incomes } = await supabase
    .from("foreign_incomes")
    .select("amount_minor, movements(amount_cop)")
    .eq("currency", "USD")
    .gte("received_on", `${year}-01-01`);

  const usdCents = (incomes ?? []).reduce((sum, i) => sum + i.amount_minor, 0);
  const cop = (incomes ?? []).reduce((sum, i) => sum + (i.movements?.amount_cop ?? 0), 0);

  return (
    <section className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Stat label={`Ingresos USD ${year}`} value={formatUsd(usdCents)} />
        <Stat label="Recibido en COP (con abono registrado)" value={formatCop(cop)} />
      </div>
      <Link href="/ingresos" className="self-start text-accent underline">
        Registrar un ingreso en USD
      </Link>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
