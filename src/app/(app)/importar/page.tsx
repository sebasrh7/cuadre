import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { StatementImporter } from "./statement-importer";

export default function ImportPage() {
  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold">Importar extracto</h1>
        <p className="text-sm text-muted">
          Sube el extracto de tu cuenta de ahorros Bancolombia (PDF). Se lee en tu navegador: el
          archivo y su contraseña nunca salen de tu equipo.
        </p>
      </div>
      <Suspense fallback={<p className="text-muted">Cargando…</p>}>
        <Importer />
      </Suspense>
    </>
  );
}

async function Importer() {
  const { supabase } = await requireUser();
  const { data } = await supabase.from("own_aliases").select("value").eq("kind", "name");
  return <StatementImporter ownNames={(data ?? []).map((a) => a.value)} />;
}
