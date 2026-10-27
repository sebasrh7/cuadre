"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type LoginState =
  | { step: "email"; error?: string }
  | { step: "code"; email: string; error?: string };

const emailSchema = z.email();
const codeSchema = z.string().trim().regex(/^\d{6}$/);

/**
 * Paso 1 envía un código de 6 dígitos al correo; paso 2 lo verifica y abre la
 * sesión. A diferencia del enlace mágico, funciona aunque el correo se abra en
 * otro dispositivo.
 */
export async function login(state: LoginState, formData: FormData): Promise<LoginState> {
  const supabase = await createClient();

  if (state.step === "email") {
    const email = emailSchema.safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
    if (!email.success) return { step: "email", error: "Escribe un correo válido." };

    const { error } = await supabase.auth.signInWithOtp({
      email: email.data,
      options: { shouldCreateUser: true },
    });
    if (error) {
      return {
        step: "email",
        error:
          error.status === 429
            ? "Pediste demasiados códigos. Espera un minuto e inténtalo de nuevo."
            : "No pudimos enviar el código. Inténtalo de nuevo.",
      };
    }
    return { step: "code", email: email.data };
  }

  if (formData.get("intent") === "change-email") return { step: "email" };

  const code = codeSchema.safeParse(formData.get("code"));
  if (!code.success) return { ...state, error: "El código tiene 6 dígitos." };

  const { error } = await supabase.auth.verifyOtp({
    email: state.email,
    token: code.data,
    type: "email",
  });
  if (error) return { ...state, error: "Código incorrecto o vencido." };

  redirect("/inicio");
}

export async function loginWithGoogle() {
  const origin = (await headers()).get("origin");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback` },
  });
  if (error || !data.url) redirect("/ingresar?error=google");
  redirect(data.url);
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
