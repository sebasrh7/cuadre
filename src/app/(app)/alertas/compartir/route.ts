import { NextResponse, type NextRequest } from "next/server";

/**
 * Respaldo de "Compartir → Cuadre" cuando el service worker todavía no está
 * activo. No lee el contenido compartido (no debe llegar al servidor): solo
 * lleva a /alertas, donde se puede pegar a mano.
 */
export function POST(request: NextRequest) {
  return NextResponse.redirect(new URL("/alertas?compartido=sin-sw", request.url), 303);
}
