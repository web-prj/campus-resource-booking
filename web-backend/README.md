# web-backend

NestJS 11 API for Campus Resource Booking, using PostgreSQL through TypeORM. It serves `http://localhost:18320/api`, with Swagger docs at `/api/docs` outside production.

## Run locally

From the repository root, start PostgreSQL with `docker compose up -d postgres`. Then, in this folder:

```bash
npm install
cp .env.example .env     # local defaults; set a real AUTH_JWT_SECRET for anything shared
npm run migration:run
npm run start:dev
```

To run everything in Docker instead, see the [root README](../README.md).

## How it works

- **Sessions:** login sets the JWT in an `httpOnly` cookie; it is never returned in a response body. Browser clients send requests with `credentials: 'include'`.
- **Secure by default:** every route requires a session unless marked `@Public()`. Restrict routes by role with `@Roles(UserRole.STAFF, ...)`.
- **USTH only:** registration and login accept exact `@usth.edu.vn` addresses.
- **Code layout:** one feature module per folder in `src/` (`auth`, `users`, `resources`, `bookings`, `analytics`, `events`, ...). Controllers handle HTTP, services hold the rules, DTOs validate input and shape responses. Configuration is read only through `src/config/`.
- **Schema:** migrations in `src/database/migrations` are the source of truth; `synchronize` stays off.
- **Scripts:** the demo data, benchmark and load-test tools live in `src/scripts/`.

## Commands

| Command | What it does |
| --- | --- |
| `npm run start:dev` | Start with reload on change |
| `npm run build` / `npm run start:prod` | Compile to `dist/` / run the compiled app |
| `npm run lint` | Lint and auto-fix |
| `npm test` | Unit tests |
| `npm run test:e2e` | End-to-end tests; need a migrated database from `.env.test` |
| `npm run migration:run` | Apply pending migrations |
| `npm run migration:generate -- src/database/migrations/Name` | Generate a migration from entity changes (review it before applying) |
| `npm run migration:revert` | Revert the last migration |
| `npm run catalog:import` / `catalog:clean` | Import or remove the demo rooms, labs, and equipment |
| `npm run bench:availability` | Benchmark availability queries ([results](../docs/benchmarks/README.md)) |
| `npm run load:test` | Load and stress test the API in a throwaway database ([results](../docs/benchmarks/performance-comparison.md)) |

## Configuration

Every variable is validated at startup, so a bad value fails immediately. `.env.example` lists them all. The ones you are most likely to change:

| Variable | Default | Purpose |
| --- | --- | --- |
| `AUTH_JWT_SECRET` | — | Signing key, at least 32 characters (required) |
| `CORS_ORIGINS` | `http://localhost:18321` | Allowed frontend origins, comma-separated |
| `AUTH_TOKEN_EXPIRES_IN` | `1d` | Session length |
| `AUTH_COOKIE_SECURE` | `true` in production | HTTPS-only cookie |
| `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME` | local Compose database | PostgreSQL connection |
| `BOOTSTRAP_ADMIN_*`, `BOOTSTRAP_STAFF_*` | unset | First admin and staff accounts ([root README](../README.md#admin-and-staff-accounts)) |
