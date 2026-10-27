import Link from "next/link";
import { logout } from "@/app/ingresar/actions";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border">
        <nav className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
          <Link href="/inicio" className="text-base font-semibold">
            Cuadre
          </Link>
          <Link href="/movimientos">Movimientos</Link>
          <Link href="/cuenta">Mi cuenta</Link>
          <form action={logout} className="ml-auto">
            <button className="text-muted">Salir</button>
          </form>
        </nav>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">{children}</main>
    </div>
  );
}
