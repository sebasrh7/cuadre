import Link from "next/link";
import { Suspense } from "react";
import { InstallApp } from "@/components/install-app";
import { requireUser } from "@/lib/auth";
import { AiToggle, DeleteAccountForm } from "./account-controls";

export default function AccountPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold">Mi cuenta</h1>
      <Suspense fallback={<p className="text-muted">Cargando…</p>}>
        <Account />
      </Suspense>
    </>
  );
}

async function Account() {
  const { supabase, userId } = await requireUser();
  const [{ data: profile }, { data: claims }] = await Promise.all([
    supabase.from("profiles").select("ai_categorization, privacy_accepted_at, privacy_version").eq("id", userId).single(),
    supabase.auth.getClaims(),
  ]);
  const email = typeof claims?.claims?.email === "string" ? claims.claims.email : null;

  return (
    <div className="flex flex-col gap-6 text-sm">
      <Card title="Tu cuenta">
        <p>Entras con Google{email ? ` (${email})` : ""}.</p>
        <p className="text-muted">
          {profile?.privacy_accepted_at ? "Aceptaste la " : "Aún no has aceptado la "}
          <Link href="/privacidad" className="underline">
            política de tratamiento de datos
          </Link>
          {profile?.privacy_accepted_at &&
            ` el ${new Date(profile.privacy_accepted_at).toLocaleDateString("es-CO", { timeZone: "America/Bogota" })} (versión ${profile.privacy_version})`}
          .{" "}
          <Link href="/onboarding" className="underline">
            Editar mis datos y cuentas
          </Link>
        </p>
      </Card>

      <Card title="App en el celular">
        <p className="text-muted">
          Instálala para abrirla como cualquier app y, en Android, compartirle alertas desde el correo o los mensajes.
          Si no ves el botón, ya está instalada o tu navegador no lo permite: búscala en el menú del navegador como
          «Instalar app» o «Agregar a la pantalla principal».
        </p>
        <InstallApp />
      </Card>

      <Card title="Categorías con IA">
        <AiToggle enabled={profile?.ai_categorization ?? false} />
      </Card>

      <Card title="Exportar">
        <p className="text-muted">Descarga tus datos cuando quieras. Son tuyos.</p>
        <div className="flex flex-wrap gap-3">
          <a href="/cuenta/exportar/movimientos" className="rounded-md border border-border px-3 py-1.5" download>
            Movimientos (Excel / CSV)
          </a>
          <a href="/cuenta/exportar/completo" className="rounded-md border border-border px-3 py-1.5" download>
            Todos mis datos (JSON)
          </a>
        </div>
      </Card>

      <Card title="Borrar cuenta" danger>
        <p>
          Borra tu cuenta y <strong>todos</strong> tus datos: movimientos, cuentas, categorías y perfil. Es inmediato y
          no se puede deshacer. Si quieres conservarlos, expórtalos antes.
        </p>
        <DeleteAccountForm />
      </Card>
    </div>
  );
}

function Card({ title, danger, children }: { title: string; danger?: boolean; children: React.ReactNode }) {
  return (
    <section className={`flex flex-col gap-3 rounded-lg border p-4 ${danger ? "border-danger" : "border-border"}`}>
      <h2 className={`font-semibold ${danger ? "text-danger" : ""}`}>{title}</h2>
      {children}
    </section>
  );
}
