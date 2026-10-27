import Link from "next/link";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-16">
      <Link href="/" className="text-2xl font-semibold tracking-tight">
        Cuadre
      </Link>
      <h1 className="text-lg font-medium">Ingresa o crea tu cuenta</h1>
      <LoginForm />
    </main>
  );
}
