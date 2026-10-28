import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { PRIVACY_VERSION } from "@/lib/privacy";
import { createClient } from "@/lib/supabase/server";

/**
 * Capa de acceso a datos: devuelve el cliente y el id del usuario, o manda al
 * login. Toda página o acción con datos del usuario pasa por aquí.
 */
export async function requireUser() {
  // La sesión se valida contra la hora actual: nunca se prerenderiza.
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/ingresar");
  return { supabase, userId };
}

/**
 * Como `requireUser`, pero exige el onboarding y la autorización de datos de
 * la versión vigente de la política (Ley 1581). Si falta, va al onboarding.
 */
export async function requireConsentedUser() {
  const { supabase, userId } = await requireUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarded_at, privacy_version, ai_categorization, arl_risk, id_last_two, calendar_token")
    .eq("id", userId)
    .single();
  if (!profile?.onboarded_at || profile.privacy_version !== PRIVACY_VERSION || profile.id_last_two === null) {
    redirect("/onboarding");
  }
  return { supabase, userId, profile };
}
