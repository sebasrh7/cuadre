import { mkdirSync, writeFileSync } from "node:fs";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export const STORAGE_STATE = "e2e/.auth/usuario.json";
export const E2E_EMAIL = "prueba-e2e@example.com";

/**
 * Crea el usuario de prueba en el Supabase LOCAL e inicia sesión con correo y
 * contraseña (solo habilitado en el Supabase del CI; en producción solo hay
 * Google). Guarda las cookies de sesión para los tests.
 */
export default async function globalSetup() {
  const url = required("NEXT_PUBLIC_SUPABASE_URL");
  if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(url)) {
    throw new Error("Las pruebas e2e solo corren contra un Supabase local");
  }
  const password = `e2e-${crypto.randomUUID()}`;

  const admin = createClient(url, required("E2E_SUPABASE_SERVICE_KEY"), { auth: { persistSession: false } });
  const { error: createError } = await admin.auth.admin.createUser({
    email: E2E_EMAIL,
    password,
    email_confirm: true,
  });
  if (createError) throw createError;

  const jar = new Map<string, string>();
  const supabase = createServerClient(url, required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"), {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (cookies) => cookies.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  const { error: signInError } = await supabase.auth.signInWithPassword({ email: E2E_EMAIL, password });
  if (signInError) throw signInError;

  mkdirSync("e2e/.auth", { recursive: true });
  writeFileSync(
    STORAGE_STATE,
    JSON.stringify({
      cookies: [...jar].map(([name, value]) => ({
        name,
        value,
        domain: "localhost",
        path: "/",
        expires: -1,
        httpOnly: false,
        secure: false,
        sameSite: "Lax",
      })),
      origins: [],
    }),
  );
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable ${name}`);
  return value;
}
