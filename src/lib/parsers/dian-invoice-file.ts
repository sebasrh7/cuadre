import { unzipSync } from "fflate";

/** Una factura con sus anexos pesa pocos KB; el límite evita descomprimir un ZIP malicioso. */
const MAX_XML_BYTES = 2_000_000;
const MAX_XML_FILES = 20;

/**
 * Devuelve el texto de los XML de un archivo de factura: el `.zip` que llega
 * por correo (XML + PDF) o el `.xml` suelto. El PDF se ignora. Si el archivo
 * no es ninguno de los dos, o está dañado, devuelve una lista vacía.
 */
export function readInvoiceXmls(bytes: Uint8Array): string[] {
  const decoder = new TextDecoder("utf-8");
  if (!isZip(bytes)) {
    return bytes.length > 0 && bytes.length <= MAX_XML_BYTES ? [decoder.decode(bytes)] : [];
  }
  try {
    let taken = 0;
    const files = unzipSync(bytes, {
      filter: (file) =>
        /\.xml$/i.test(file.name) && file.originalSize <= MAX_XML_BYTES && taken++ < MAX_XML_FILES,
    });
    return Object.values(files).map((content) => decoder.decode(content));
  } catch {
    return [];
  }
}

/** Todo ZIP empieza con `PK\x03\x04`. */
function isZip(bytes: Uint8Array): boolean {
  return bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}
