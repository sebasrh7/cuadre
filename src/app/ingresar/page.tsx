import Link from "next/link";
import { Suspense } from "react";
import { FormError } from "@/components/ui";
import { LoginForm } from "./login-form";

export default function LoginPage({ searchParams }: PageProps<"/ingresar">) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-16">
      <Link href="/" className="text-2xl font-semibold tracking-tight">
        Cuadre
      </Link>
      <h1 className="text-lg font-medium">Ingresa o crea tu cuenta</h1>
      {/* Solo el aviso espera la URL; el formulario no se vuelve a montar y no pierde lo escrito. */}
      <Suspense>
        <LinkError searchParams={searchParams} />
      </Suspense>
      <LoginForm />
    </main>
  );
}

async function LinkError({ searchParams }: Pick<PageProps<"/ingresar">, "searchParams">) {
  const { error } = await searchParams;
  if (error !== "link") return null;
  return <FormError message="El enlace venció o se abrió en otro navegador. Pide uno nuevo." />;
}
