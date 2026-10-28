import type { BrowserOptions } from "@sentry/nextjs";

/**
 * Opciones comunes de Sentry (cliente, servidor y edge). Solo errores, y sin
 * nada que pueda llevar datos financieros o personales: los cuerpos de las
 * peticiones (p. ej. la importación del extracto), cookies, encabezados,
 * parámetros de URL ni variables locales. Sin DSN, Sentry queda apagado.
 */
export const sentryOptions = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
  tracesSampleRate: 0,
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: false,
    httpBodies: [],
    urlQueryParams: false,
    stackFrameVariables: false,
    genAI: { inputs: false, outputs: false },
  },
} satisfies BrowserOptions;
