import { z } from "zod";

// Next solo incrusta en el cliente las variables NEXT_PUBLIC_* leídas de forma literal.
const parsed = z
  .object({
    NEXT_PUBLIC_SUPABASE_URL: z.url(),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  })
  .safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });

if (!parsed.success) {
  throw new Error("Faltan variables de Supabase: copia .env.example como .env.local y llénalo.");
}

export const env = parsed.data;
