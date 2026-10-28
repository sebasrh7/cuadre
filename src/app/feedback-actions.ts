"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth";

const feedbackSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  page: z.string().max(200),
});

export type FeedbackState = { sent?: boolean; error?: string };

export async function sendFeedback(_state: FeedbackState, formData: FormData): Promise<FeedbackState> {
  const parsed = feedbackSchema.safeParse({ message: formData.get("message"), page: formData.get("page") ?? "" });
  if (!parsed.success) return { error: "Escribe tu comentario (máximo 2.000 caracteres)." };

  const { supabase } = await requireUser();
  const { error } = await supabase.from("feedback").insert(parsed.data);
  return error ? { error: "No pudimos enviarlo. Inténtalo de nuevo." } : { sent: true };
}
