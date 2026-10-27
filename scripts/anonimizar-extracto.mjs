// Extrae el texto de un extracto PDF con su posición en la página y lo
// anonimiza EN TU EQUIPO, para poder escribir el parser sin ver datos reales.
//
// Uso (en tu propia terminal, no con `!` dentro de Claude Code):
//   node scripts/anonimizar-extracto.mjs "C:\ruta\extracto.pdf" [salida.txt]
//
// Pide la contraseña del PDF sin mostrarla. Nada sale del equipo.
// Qué se conserva: la posición de cada texto, la forma de los números
// (`$9.999.999,99`, `99/99`) y solo las palabras de la lista PERMITIDAS.
// Todo lo demás (nombres, comercios, direcciones, números) se reemplaza.
// Revisa el archivo de salida antes de compartirlo.

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stdin, stdout, argv, exit } from "node:process";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const PERMITIDAS = new Set(
  `
  estado extracto cuenta cuentas ahorros ahorro corriente tarjeta debito credito
  fecha fechas desde hasta periodo corte mes dia ano pagina de del la las el los a al en y o con por para sin
  descripcion sucursal canal dcto documento referencia valor valores saldo saldos anterior actual final inicial
  total totales abono abonos cargo cargos debitos creditos promedio disponible movimientos movimiento resumen
  giro internacional exterior transferencia transf trans traslado pago pagos compra compras retiro retiros
  cajero corresponsal consignacion nomina pse qr llave bre-b breb recibida recibido enviada enviado
  cuota manejo iva gmf impuesto 4x1000 intereses interes rendimientos retencion fuente comision comisiones
  servicio servicios recaudo descuento reversion ajuste devolucion cancelacion app virtual sucursal
  bancolombia nequi daviplata banco bancos nu
  ene feb mar abr may jun jul ago sep oct nov dic
  enero febrero marzo abril mayo junio julio agosto septiembre octubre noviembre diciembre
  `
    .split(/\s+/)
    .filter(Boolean),
);

/** Quita tildes y pasa a minúsculas para comparar con PERMITIDAS. */
function normalizar(palabra) {
  return palabra.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

function anonimizar(texto) {
  return texto
    .replace(/\d/g, "9")
    .replace(/[\p{L}][\p{L}\p{M}\-]*/gu, (palabra) =>
      PERMITIDAS.has(normalizar(palabra)) ? palabra : "X".repeat(Math.min(palabra.length, 4)),
    );
}

async function pedirContrasena() {
  if (!stdin.isTTY) {
    throw new Error("Corre el script en tu propia terminal: necesita pedir la contraseña.");
  }
  stdout.write("Contraseña del PDF (Enter si no tiene): ");
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");
  return new Promise((resolve) => {
    let contrasena = "";
    stdin.on("data", (tecla) => {
      if (tecla === "\r" || tecla === "\n") {
        stdin.setRawMode(false);
        stdin.pause();
        stdout.write("\n");
        resolve(contrasena);
      } else if (tecla === "\u0003") {
        exit(1);
      } else if (tecla === "\u007f" || tecla === "\b") {
        contrasena = contrasena.slice(0, -1);
      } else {
        contrasena += tecla;
      }
    });
  });
}

async function main() {
  const [entrada, salidaArg] = argv.slice(2);
  if (!entrada) {
    console.error('Uso: node scripts/anonimizar-extracto.mjs "ruta\\extracto.pdf" [salida.txt]');
    exit(1);
  }
  const salida =
    salidaArg ?? path.join(path.dirname(entrada), `${path.parse(entrada).name}.anonimizado.txt`);

  const password = process.env.EXTRACTO_PASSWORD ?? (await pedirContrasena());
  const data = new Uint8Array(await readFile(entrada));
  // pdf.js exige la ruta con `/` final, también en Windows.
  const standardFontDataUrl = fileURLToPath(
    new URL("../node_modules/pdfjs-dist/standard_fonts/", import.meta.url),
  ).replaceAll("\\", "/");
  const pdf = await getDocument({
    data,
    password: password || undefined,
    standardFontDataUrl,
  }).promise;

  const lineas = [`# ${pdf.numPages} páginas · formato: p<página> y=<alto> | x=<columna> "texto"`];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const { items } = await page.getTextContent();

    // Agrupa los fragmentos por renglón (misma altura, con 2 puntos de tolerancia).
    const renglones = new Map();
    for (const item of items) {
      if (!("str" in item) || !item.str.trim()) continue;
      const [, , , , x, y] = item.transform;
      const clave = [...renglones.keys()].find((k) => Math.abs(k - y) <= 2) ?? y;
      if (!renglones.has(clave)) renglones.set(clave, []);
      renglones.get(clave).push({ x, str: item.str });
    }

    for (const [y, partes] of [...renglones].sort((a, b) => b[0] - a[0])) {
      const celdas = partes
        .sort((a, b) => a.x - b.x)
        .map(({ x, str }) => `x=${Math.round(x)} "${anonimizar(str.trim())}"`);
      lineas.push(`p${n} y=${Math.round(y)} | ${celdas.join(" | ")}`);
    }
  }

  await writeFile(salida, lineas.join("\n") + "\n", "utf8");
  console.log(`Listo: ${salida}`);
  console.log("Ábrelo y revisa que no quede ningún dato tuyo antes de compartirlo.");
}

main().catch((error) => {
  console.error(
    error?.name === "PasswordException" ? "Contraseña incorrecta." : `Error: ${error.message}`,
  );
  exit(1);
});
