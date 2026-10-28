import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withSentryConfig(nextConfig, {
  org: "cuadreappco",
  project: process.env.SENTRY_PROJECT ?? "cuadre",
  // Sin token no se suben los source maps: los errores llegan igual, con trazas minificadas.
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  // Los errores del navegador pasan por el propio dominio: los bloqueadores no los descartan.
  tunnelRoute: "/monitoreo",
  telemetry: false,
});
