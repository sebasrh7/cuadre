// Saca la ESTRUCTURA de una factura electrónica (ZIP o XML) y la anonimiza
// EN TU EQUIPO, para comprobar el lector de facturas contra el formato real
// sin ver datos reales.
//
// Uso (en tu propia terminal):
//   npm run anonimizar-factura -- "C:\ruta\factura.zip" [salida.xml]
//
// Nada sale del equipo. Qué se conserva: los nombres de las etiquetas y de
// los atributos, y la forma de cada valor (`9999-99-99`, `99999.99`, `XXXX`).
// Todas las letras y todos los dígitos se reemplazan; los valores largos
// (firmas, códigos) se recortan. Solo quedan tal cual unos pocos códigos del
// estándar que no dicen nada de ti (moneda, tipo de documento, versión).
// Revisa el archivo de salida antes de compartirlo.

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { argv, exit } from "node:process";
import { unzipSync } from "fflate";

/** Etiquetas cuyo texto es un código del estándar, no un dato del usuario. */
const TEXTO_PERMITIDO = new Set([
  "UBLVersionID",
  "CustomizationID",
  "ProfileID",
  "ProfileExecutionID",
  "InvoiceTypeCode",
  "CreditNoteTypeCode",
  "DocumentCurrencyCode",
  "DocumentType",
  "DocumentTypeCode",
  "MimeCode",
  "EncodingCode",
]);
/** Atributos cuyo valor es un código del estándar. */
const ATRIBUTO_PERMITIDO = new Set(["currencyID", "schemeName", "schemeAgencyID", "unitCode", "listName", "encoding", "version", "standalone"]);
const MAX_VALOR = 24;

function enmascarar(valor) {
  const corto = valor.length > MAX_VALOR ? `${valor.slice(0, MAX_VALOR)}…(${valor.length})` : valor;
  return corto.replace(/\d/g, "9").replace(/\p{L}/gu, "X");
}

function anonimizarEtiqueta(etiqueta) {
  // `xmlns` se conserva: dice qué tipo de documento es, no de quién.
  return etiqueta.replace(/([\w:.-]+)\s*=\s*(["'])([\s\S]*?)\2/g, (todo, nombre, comilla, valor) =>
    nombre.startsWith("xmlns") || ATRIBUTO_PERMITIDO.has(nombre.split(":").pop())
      ? todo
      : `${nombre}=${comilla}${enmascarar(valor)}${comilla}`,
  );
}

function anonimizar(xml) {
  // Las facturas van como texto (CDATA o escapadas) dentro del contenedor: se abren para ver su estructura.
  const abierto = xml
    .replaceAll("<![CDATA[", "\n<!-- inicio CDATA -->\n")
    .replaceAll("]]>", "\n<!-- fin CDATA -->\n")
    .replace(/&lt;([/?]?[A-Za-z][\s\S]*?)&gt;/g, "<$1>");

  let actual = "";
  return abierto.replace(/<!--[\s\S]*?-->|<[^>]+>|[^<]+/g, (parte) => {
    if (parte.startsWith("<!--")) return parte.includes("CDATA") ? parte : "<!-- X -->";
    if (parte.startsWith("<")) {
      const nombre = /^<\/?\??\s*([\w:.-]+)/.exec(parte)?.[1] ?? "";
      if (!parte.startsWith("</")) actual = nombre.split(":").pop();
      return anonimizarEtiqueta(parte);
    }
    if (!parte.trim()) return parte;
    return TEXTO_PERMITIDO.has(actual) ? parte : parte.replace(/\S[\s\S]*\S|\S/, (texto) => enmascarar(texto));
  });
}

async function main() {
  const [entrada, salidaArg] = argv.slice(2);
  if (!entrada) {
    console.error('Uso: npm run anonimizar-factura -- "ruta\\factura.zip" [salida.xml]');
    exit(1);
  }
  const salida = salidaArg ?? path.join(path.dirname(entrada), `${path.parse(entrada).name}.anonimizado.xml`);

  const bytes = new Uint8Array(await readFile(entrada));
  const esZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  const archivos = esZip
    ? Object.entries(unzipSync(bytes, { filter: (f) => /\.xml$/i.test(f.name) }))
    : [[path.basename(entrada), bytes]];
  if (!archivos.length) throw new Error("El ZIP no trae ningún XML.");

  const decoder = new TextDecoder("utf-8");
  const partes = archivos.map(
    ([, contenido], i) => `<!-- ===== archivo ${i + 1} de ${archivos.length} ===== -->\n${anonimizar(decoder.decode(contenido))}`,
  );
  await writeFile(salida, partes.join("\n\n") + "\n", "utf8");
  console.log(`Listo: ${salida}`);
  console.log("Ábrelo y revisa que no quede ningún dato tuyo antes de compartirlo.");
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  exit(1);
});
