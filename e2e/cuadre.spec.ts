import { expect, test } from "@playwright/test";
import { buildNequiStatement } from "../src/lib/parsers/__fixtures__/nequi-statement";
import { buildStatementPdf } from "../src/lib/parsers/__fixtures__/statement-pdf";
import { STORAGE_STATE } from "./global-setup";

test.describe("sin sesión", () => {
  test("las páginas con datos piden iniciar sesión", async ({ page }) => {
    await page.goto("/inicio");
    await expect(page).toHaveURL(/\/ingresar$/);
    await expect(page.getByRole("button", { name: "Continuar con Google" })).toBeVisible();
  });

  test("la política de datos es pública", async ({ page }) => {
    await page.goto("/privacidad");
    await expect(page.getByRole("heading", { name: "Política de tratamiento de datos personales" })).toBeVisible();
  });

  test("un calendario con token desconocido no existe", async ({ request }) => {
    const response = await request.get("/calendario/00000000-0000-4000-8000-000000000000");
    expect(response.status()).toBe(404);
  });
});

test.describe("flujo completo de un usuario", () => {
  // Comparten un usuario y cada test depende del anterior: reintentar a mitad de camino no tiene sentido.
  test.describe.configure({ mode: "serial", retries: 0 });
  test.use({ storageState: STORAGE_STATE });

  const statement = async () => ({
    name: "extracto.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(await buildStatementPdf()),
  });

  test("sin autorización de datos lleva al onboarding y lo completa", async ({ page }) => {
    await page.goto("/inicio");
    await expect(page).toHaveURL(/\/onboarding$/);

    await page.getByLabel("Dos últimos dígitos de tu cédula").fill("10");
    await page.getByLabel("Tu nombre como aparece en las transferencias").fill("Andrés Prueba Ejemplo");
    await page.getByLabel("Cuenta de ahorros Bancolombia").fill("8901");
    await page.getByLabel(/Autorizo a Cuadre a tratar mis datos/).check();
    await page.getByRole("button", { name: "Guardar" }).click();

    await expect(page).toHaveURL(/\/inicio$/);
    await expect(page.getByRole("heading", { name: "Inicio" })).toBeVisible();
  });

  test("pega una alerta y la ve como movimiento provisional", async ({ page }) => {
    await page.goto("/alertas");
    // Alerta sintética de una compra que también está en el extracto de prueba (5 de diciembre).
    await page
      .getByLabel("Alertas")
      .fill("Bancolombia: Compraste $45.900,00 en TIENDA EJEMPLO con tu T.Deb *1111, el 05/12/2026 a las 10:00. Si tienes dudas…");
    await page.getByRole("button", { name: "Leer alertas" }).click();
    await expect(page.getByRole("listitem").getByText("TIENDA EJEMPLO")).toBeVisible();
    await page.getByRole("button", { name: "Guardar 1 alerta" }).click();
    await expect(page.getByText("1 movimiento nuevo")).toBeVisible();

    await page.goto("/movimientos");
    await expect(page.getByText("alerta", { exact: true })).toBeVisible();
  });

  test("recibe una alerta compartida desde otra app (Compartir → Cuadre)", async ({ page }) => {
    await page.goto("/alertas");
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    expect(await page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);

    // Lo mismo que hace Android al compartir: un POST multipart al share_target del manifest.
    await page.evaluate(() => {
      const form = document.createElement("form");
      form.method = "POST";
      form.action = "/alertas/compartir";
      form.enctype = "multipart/form-data";
      const text = document.createElement("textarea");
      text.name = "text";
      text.value = "Bancolombia: Compraste $9.900,00 en CAFE COMPARTIDO con tu T.Deb *1111, el 06/12/2026 a las 08:00.";
      form.append(text);
      document.body.append(form);
      form.submit();
    });

    await expect(page).toHaveURL(/\/alertas$/);
    await expect(page.getByRole("listitem").getByText("CAFE COMPARTIDO")).toBeVisible();
  });

  test("sin service worker, lo compartido no llega al servidor", async ({ request }) => {
    const response = await request.post("/alertas/compartir", {
      multipart: { text: "Bancolombia: Compraste $1.000,00 en NO DEBE LLEGAR" },
      maxRedirects: 0,
    });
    expect(response.status()).toBe(303);
    expect(response.headers().location).toContain("/alertas?compartido=sin-sw");
  });

  test("importa el extracto con vista previa verificada", async ({ page }) => {
    await page.goto("/importar");
    await page.getByLabel("Extracto (PDF)").setInputFiles(await statement());
    await page.getByRole("button", { name: "Leer extracto" }).click();

    await expect(page.getByText("✓ El extracto cuadra.")).toBeVisible();
    await expect(page.getByText(/8 movimientos del 2026-11-30 al 2027-01-31/)).toBeVisible();
    // El nombre propio del onboarding marca sola la transferencia a sí mismo.
    await expect(page.getByLabel(/Transferencias a ANDRES PRUEBA EJEMPLO son mías/)).toBeChecked();

    await page.getByRole("button", { name: "Guardar movimientos" }).click();
    // 5 movimientos + 1 de intereses agrupados (diciembre suma $0 y se omite).
    await expect(page.getByText("6 movimientos nuevos")).toBeVisible();
    // La alerta del 5 de diciembre ya está en el extracto: se reemplaza.
    await expect(page.getByText("1 alerta reemplazada por el extracto")).toBeVisible();
  });

  test("reimportar el mismo extracto no duplica nada", async ({ page }) => {
    await page.goto("/importar");
    await page.getByLabel("Extracto (PDF)").setInputFiles(await statement());
    await page.getByRole("button", { name: "Leer extracto" }).click();
    await page.getByRole("button", { name: "Guardar movimientos" }).click();

    await expect(page.getByText("0 movimientos nuevos")).toBeVisible();
    await expect(page.getByText("6 ya estaban guardados y se omitieron")).toBeVisible();
  });

  test("importa también un extracto de Nequi y reconoce el banco", async ({ page }) => {
    await page.goto("/importar");
    await page.getByLabel("Extracto (PDF)").setInputFiles({
      name: "nequi.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(await buildStatementPdf(buildNequiStatement())),
    });
    await page.getByRole("button", { name: "Leer extracto" }).click();
    await expect(page.getByText(/8 movimientos del 2026-09-01 al 2026-09-30, cuenta Nequi \*8877/)).toBeVisible();
    await page.getByRole("button", { name: "Guardar movimientos" }).click();
    // 7 movimientos + 1 de intereses agrupados.
    await expect(page.getByText("8 movimientos nuevos")).toBeVisible();
  });

  test("los movimientos quedan agrupados por mes", async ({ page }) => {
    await page.goto("/movimientos");
    await expect(page.getByRole("heading", { name: "Diciembre de 2026" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Enero de 2027" })).toBeVisible();
    await expect(page.getByText("Giro internacional")).toBeVisible();
    await expect(page.getByText("TIENDA EJEMPLO")).toBeVisible();
    await expect(page.getByText("alerta", { exact: true })).toHaveCount(0);
  });

  test("exporta los movimientos a CSV", async ({ page }) => {
    const response = await page.request.get("/cuenta/exportar/movimientos");
    expect(response.status()).toBe(200);
    const csv = await response.text();
    expect(csv).toContain("Fecha;Tipo;Valor (COP)");
    // Encabezado + 6 de Bancolombia + 8 de Nequi.
    expect(csv.trim().split("\r\n")).toHaveLength(15);
  });

  test("borra la cuenta y todos sus datos", async ({ page }) => {
    await page.goto("/cuenta");
    await page.getByLabel(/Escribe BORRAR/).fill("BORRAR");
    await page.getByRole("button", { name: "Borrar mi cuenta y todos mis datos" }).click();
    await expect(page).toHaveURL(/\/(\?cuenta=borrada)?$/);

    await page.goto("/inicio");
    await expect(page).toHaveURL(/\/ingresar$/);
  });
});
