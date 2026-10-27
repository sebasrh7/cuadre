// Sube supabase/config.toml al proyecto enlazado. Lee los secretos (`env(...)`
// en el config) desde .env.local sin pasar por el shell, para que los valores
// con espacios no se partan ni aparezcan en la consola.
//
// Uso: npm run db:config            → muestra los cambios sin aplicarlos
//      npm run db:config -- --yes   → los aplica

import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { argv, exit } from "node:process";

const env = { ...process.env };
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (match) env[match[1]] = match[2].trim().replace(/^(["'])(.*)\1$/, "$2");
}
// Google muestra la contraseña de aplicación con espacios; SMTP la quiere sin ellos.
if (env.SMTP_GMAIL_APP_PASSWORD) {
  env.SMTP_GMAIL_APP_PASSWORD = env.SMTP_GMAIL_APP_PASSWORD.replace(/\s/g, "");
}

const secrets = ["SMTP_GMAIL_APP_PASSWORD", "GOOGLE_OAUTH_CLIENT_SECRET"]
  .map((name) => env[name])
  .filter(Boolean);
const apply = argv.includes("--yes");

const result = spawnSync("npx", ["supabase", "config", "push", ...(apply ? ["--yes"] : [])], {
  env,
  input: apply ? undefined : "n\nn\nn\n",
  encoding: "utf8",
  shell: true,
});

let output = `${result.stdout}${result.stderr}`;
for (const secret of secrets) output = output.replaceAll(secret, "***");
const relevant = output
  .split("\n")
  .filter((line) => /^\w[\w.]+ \[|"service":"auth","status"|Error|status 4\d\d/.test(line));
console.log(relevant.join("\n") || output);
exit(result.status ?? 1);
