import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { PRIVACY_VERSION } from "@/lib/privacy";
import { OnboardingForm, type OnboardingDefaults } from "./onboarding-form";

export default function OnboardingPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold">Tus datos</h1>
      <Suspense fallback={<p className="text-muted">Cargando…</p>}>
        <SavedOnboarding />
      </Suspense>
    </>
  );
}

async function SavedOnboarding() {
  const { supabase, userId } = await requireUser();
  const [profile, accounts, aliases] = await Promise.all([
    supabase
      .from("profiles")
      .select("worker_type, arl_risk, id_last_two, privacy_version, ai_categorization")
      .eq("id", userId)
      .single(),
    supabase.from("own_accounts").select("kind, last4"),
    supabase.from("own_aliases").select("kind, value").order("created_at"),
  ]);

  const last4 = (kind: string) => accounts.data?.find((a) => a.kind === kind)?.last4 ?? "";
  const join = (kind: string) =>
    (aliases.data ?? []).filter((a) => a.kind === kind).map((a) => a.value).join(", ");

  const defaults: OnboardingDefaults = {
    workerType: profile.data?.worker_type ?? "freelancer",
    arlRisk: String(profile.data?.arl_risk ?? 1),
    idLastTwo: profile.data?.id_last_two?.toString().padStart(2, "0") ?? "",
    ownNames: join("name"),
    ownKeys: join("key"),
    savingsLast4: last4("savings"),
    debitCardLast4: last4("debit_card"),
    creditCardLast4: last4("credit_card"),
    privacyAccepted: profile.data?.privacy_version === PRIVACY_VERSION,
    aiCategorization: profile.data?.ai_categorization ?? false,
  };

  return <OnboardingForm defaults={defaults} />;
}
