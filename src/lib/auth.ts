import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
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
