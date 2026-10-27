"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";

export async function setAiCategorization(enabled: boolean) {
  const { supabase, userId } = await requireUser();
  await supabase.from("profiles").update({ ai_categorization: enabled }).eq("id", userId);
  refresh();
}

export type DeleteState = { error?: string };

/** Borra la cuenta y, en cascada, todos los datos del usuario. */
export async function deleteAccount(_state: DeleteState, formData: FormData): Promise<DeleteState> {
  if (formData.get("confirmation") !== "BORRAR") {
    return { error: "Escribe BORRAR, en mayúsculas, para confirmar." };
  }
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("delete_my_account");
  if (error) return { error: "No pudimos borrar tu cuenta. Inténtalo de nuevo." };

  // La sesión apunta a un usuario que ya no existe: se cierra localmente.
  await supabase.auth.signOut({ scope: "local" });
  redirect("/?cuenta=borrada");
}
