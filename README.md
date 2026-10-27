# Cuadre

Copiloto financiero para independientes en Colombia: ingresos en USD con su tasa efectiva, gastos desde las alertas y el extracto de Bancolombia, y detección de transferencias entre cuentas propias.

Alcance y plan: [`docs/ALCANCE.md`](docs/ALCANCE.md).

## Desarrollo

Requiere Node 22.13+.

```bash
npm install
cp .env.example .env.local   # llena las llaves de Supabase
npm run dev
```

| Comando | Qué hace |
|---|---|
| `npm test` | Tests (Vitest) |
| `npm run typecheck` | Tipos de rutas de Next + `tsc` |
| `npm run lint` | ESLint |
| `npm run db:push` | Aplica las migraciones al proyecto de Supabase enlazado |
| `npm run db:types` | Regenera los tipos de la base de datos |

## Privacidad

- El extracto PDF se lee en el navegador; el archivo y su contraseña no salen del dispositivo.
- Solo se guardan los últimos 4 dígitos de cuentas y tarjetas.
- Todas las tablas con datos de usuario tienen Row Level Security.
