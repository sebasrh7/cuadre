import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { PRIVACY_VERSION, privacyContact } from "@/lib/privacy";

export const metadata: Metadata = { title: "Política de tratamiento de datos · Cuadre" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-12 text-sm leading-relaxed">
      <Link href="/" className="text-2xl font-semibold tracking-tight">
        Cuadre
      </Link>
      <div>
        <h1 className="text-xl font-semibold">Política de tratamiento de datos personales</h1>
        <p className="text-muted">Versión {PRIVACY_VERSION}. Ley 1581 de 2012 y Decreto 1377 de 2013.</p>
      </div>

      <Section title="1. Responsable">
        <Suspense fallback={<p>Cargando…</p>}>
          <Controller />
        </Suspense>
      </Section>

      <Section title="2. Qué datos tratamos">
        <ul className="list-disc pl-5">
          <li>De tu cuenta de Google: nombre y correo, solo para identificarte. No leemos tu correo.</li>
          <li>
            Lo que escribes en la app: tipo de trabajo, nivel de riesgo ARL, último dígito de tu cédula o NIT, los
            nombres y llaves con los que recibes transferencias y los <strong>últimos 4 dígitos</strong> de tus
            cuentas y tarjetas.
          </li>
          <li>
            De tu extracto: fecha, valor, comercio o persona y categoría de cada movimiento. Los extractos pueden
            incluir nombres de terceros (personas a las que les transfieres); los usamos solo para mostrarte tus
            movimientos.
          </li>
        </ul>
        <p>
          <strong>No recibimos ni guardamos</strong> el PDF del extracto ni su contraseña (se leen en tu navegador),
          ni números completos de cuentas o tarjetas, ni contraseñas.
        </p>
      </Section>

      <Section title="3. Para qué">
        <p>
          Mostrarte tus ingresos y gastos, separar las transferencias entre tus propias cuentas, estimar tus aportes
          a seguridad social y avisarte si podrías estar obligado a declarar renta. No vendemos ni compartimos tus
          datos con fines comerciales ni publicitarios.
        </p>
      </Section>

      <Section title="4. Con quién se comparten (encargados)">
        <ul className="list-disc pl-5">
          <li>
            <strong>Supabase</strong>: base de datos y autenticación. Los datos se guardan en São Paulo, Brasil
            (transferencia internacional).
          </li>
          <li>
            <strong>Vercel</strong>: aloja la aplicación; las funciones corren en São Paulo, Brasil.
          </li>
          <li>
            <strong>Google</strong>: inicio de sesión. Y, <strong>solo si lo activas</strong>, Gemini para sugerir la
            categoría de tus gastos: recibe únicamente nombres de comercio (por ejemplo, &quot;TIENDA D1&quot;), sin
            montos, fechas ni nombres de personas. En el plan gratuito de Gemini, Google puede usar lo que recibe para
            mejorar sus productos. Puedes apagarlo cuando quieras en Mi cuenta.
          </li>
        </ul>
      </Section>

      <Section title="5. Tus derechos">
        <p>Puedes conocer, actualizar, rectificar y suprimir tus datos, y revocar esta autorización:</p>
        <ul className="list-disc pl-5">
          <li>Corregir tus datos y categorías directamente en la app.</li>
          <li>Descargar todos tus datos en Mi cuenta → Exportar.</li>
          <li>Borrar tu cuenta y todos tus datos en Mi cuenta → Borrar cuenta. El borrado es inmediato y definitivo.</li>
          <li>
            Para consultas o reclamos, escribe al correo de contacto. Respondemos consultas en máximo 10 días hábiles y
            reclamos en máximo 15 días hábiles. También puedes acudir a la Superintendencia de Industria y Comercio.
          </li>
        </ul>
      </Section>

      <Section title="6. Seguridad y conservación">
        <p>
          Cada usuario solo puede ver sus propios datos (control de acceso por fila en la base de datos). Las
          conexiones van cifradas. Guardamos tus datos mientras tengas cuenta; al borrarla se eliminan.
        </p>
      </Section>

      <Section title="7. Aviso">
        <p>
          Cuadre es una herramienta de apoyo y no es asesoría contable ni tributaria. Los cálculos usan valores
          oficiales con su fuente, pero confirma tus obligaciones con un contador.
        </p>
      </Section>
    </main>
  );
}

async function Controller() {
  await connection();
  const { controller, email } = privacyContact();
  return (
    <p>
      {controller ?? "El operador de Cuadre"}, persona natural, en Colombia. Contacto:{" "}
      {email ? (
        <a href={`mailto:${email}`} className="underline">
          {email}
        </a>
      ) : (
        "pendiente de publicar"
      )}
      .
    </p>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-semibold">{title}</h2>
      {children}
    </section>
  );
}
