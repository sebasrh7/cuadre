import { Suspense } from "react";
import { requireConsentedUser } from "@/lib/auth";
import { loadOwnIdentity } from "@/lib/movements/load";
import { AlertPaster } from "./alert-paster";

export default function AlertsPage() {
  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold">Pegar alertas</h1>
        <p className="text-sm text-muted">
          Copia las alertas de Bancolombia (correo o SMS de compras y transferencias) y pégalas aquí, una o varias a la
          vez. Así ves los gastos del mes antes de que llegue el extracto. Se leen en tu navegador: el texto no se
          envía. En Android, con Cuadre instalada, también puedes usar Compartir → Cuadre desde el correo o los
          mensajes.
        </p>
      </div>
      <Suspense fallback={<p className="text-muted">Cargando…</p>}>
        <Paster />
      </Suspense>
    </>
  );
}

async function Paster() {
  const { supabase } = await requireConsentedUser();
  return <AlertPaster own={await loadOwnIdentity(supabase)} />;
}
