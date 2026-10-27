import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-6 px-4 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">Cuadre</h1>
      <p className="text-lg text-muted">
        Tus finanzas de independiente, cuadradas. Importa tu extracto de Bancolombia y mira cuánto
        recibes al mes, en qué gastas, cuánto te toca aportar a seguridad social y si vas a tener que
        declarar renta.
      </p>
      <ul className="flex flex-col gap-2 text-sm">
        <li>• Tu extracto se lee en tu navegador: el PDF y su contraseña nunca salen de tu equipo.</li>
        <li>• Solo guardamos los últimos 4 dígitos de tus cuentas.</li>
        <li>• Gratis. Puedes exportar o borrar tus datos cuando quieras.</li>
      </ul>
      <Link
        href="/ingresar"
        className="self-start rounded-md bg-accent px-5 py-3 font-medium text-white dark:text-black"
      >
        Ingresar
      </Link>
      <Link href="/privacidad" className="text-xs text-muted underline">
        Política de tratamiento de datos
      </Link>
    </main>
  );
}
