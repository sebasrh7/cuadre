"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type LoginState =
  | { step: "email"; error?: string }
  | { step: "sent"; email: string };

const emailSchema = z.email();

/**
 * Envía un enlace mágico. El plan gratuito de Supabase no deja cambiar la
 * plantilla del correo, así que no se puede enviar un código; con SMTP propio
 * (Resend) se podría volver al código de 6 dígitos.
 */
export async function login(_state: LoginState, formData: FormData): Promise<LoginState> {
  const email = emailSchema.safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
  if (!email.success) return { step: "email", error: "Escribe un correo válido." };

  const origin = (await headers()).get("origin");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: email.data,
    options: { shouldCreateUser: true, emailRedirectTo: `${origin}/auth/callback` },
  });

  if (error) {
    return {
      step: "email",
      error:
        error.status === 429
          ? "Pediste demasiados enlaces. Espera unos minutos e inténtalo de nuevo."
          : "No pudimos enviar el enlace. Inténtalo de nuevo.",
    };
  }
  return { step: "sent", email: email.data };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
