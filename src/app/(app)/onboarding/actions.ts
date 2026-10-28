"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { PRIVACY_VERSION } from "@/lib/privacy";
import { onboardingSchema } from "@/lib/schemas";

export type OnboardingState = {
  errors?: Partial<Record<string, string>>;
  error?: string;
};

export async function saveOnboarding(
  _state: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const parsed = onboardingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      errors[String(issue.path[0])] ??= issue.message;
    }
    return { errors };
  }

  const input = parsed.data;
  const { supabase, userId } = await requireUser();

  // La autorización se registra antes de guardar cualquier otro dato.
  const consent = await supabase
    .from("profiles")
    .update({
      privacy_accepted_at: new Date().toISOString(),
      privacy_version: PRIVACY_VERSION,
      ai_categorization: input.aiCategorization,
      id_last_two: input.idLastTwo,
    })
    .eq("id", userId);
  if (consent.error) return { error: "No pudimos guardar. Inténtalo de nuevo." };

  const accounts = (
    [
      ["savings", input.savingsLast4],
      ["debit_card", input.debitCardLast4],
      ["credit_card", input.creditCardLast4],
    ] as const
  ).flatMap(([kind, last4]) => (last4 ? [{ institution: "bancolombia", kind, last4 }] : []));

  const { error } = await supabase.rpc("save_onboarding", {
    p_worker_type: input.workerType,
    p_arl_risk: input.arlRisk,
    p_nit_last_digit: input.idLastTwo % 10,
    p_accounts: accounts,
    p_aliases: [
      ...input.ownNames.map((value) => ({ kind: "name", value })),
      ...input.ownKeys.map((value) => ({ kind: "key", value })),
    ],
  });

  if (error) return { error: "No pudimos guardar. Inténtalo de nuevo." };

  redirect("/inicio");
}
