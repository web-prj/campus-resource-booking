# Campus Resource Booking

A USTH web app for finding, booking, approving, and managing university rooms, laboratories, and equipment.

- `web-frontend/` — Next.js 16 and React 19 ([README](web-frontend/README.md))
- `web-backend/` — NestJS 11, TypeORM, and PostgreSQL ([README](web-backend/README.md))
- `docs/` — project proposal, [release checklist](docs/MVP_RELEASE.md), [deployment](docs/DEPLOYMENT.md), [benchmarks](docs/benchmarks/README.md)

## Quick start

Requires Docker with Compose v2. From the repository root:

```bash
cp .env.example .env
openssl rand -base64 48   # paste the output into AUTH_JWT_SECRET in .env
docker compose up -d --build
```

The first build takes a few minutes. Database migrations run automatically.

| Service | URL |
| --- | --- |
| Frontend | http://localhost:18321 |
| API | http://localhost:18320/api |
| API docs | http://localhost:18320/api/docs |
| PostgreSQL | `localhost:18322` (this machine only) |

## Running the containers

```bash
docker compose up -d            # start
docker compose stop             # stop (containers and data are kept)
docker compose restart          # restart
docker compose up -d --build    # rebuild after pulling code or editing .env
docker compose ps               # status; all services should be "healthy"
docker compose logs -f backend  # follow logs (Ctrl+C to exit)
```

Database data lives in a Docker volume and survives all of the commands above. `docker compose down -v` **deletes it permanently**.

If a port is taken, change `BACKEND_PORT`, `FRONTEND_PORT`, or `DB_HOST_PORT` in `.env`, update `NEXT_PUBLIC_API_URL` and `CORS_ORIGINS` to match, then rebuild.

## Admin and staff accounts

Registration only creates students. Set the first admin and staff accounts in `.env`, then run `docker compose up -d`:

```bash
BOOTSTRAP_ADMIN_EMAIL=first.admin@usth.edu.vn
BOOTSTRAP_ADMIN_PASSWORD=<a strong password>
BOOTSTRAP_STAFF_EMAIL=first.staff@usth.edu.vn
BOOTSTRAP_STAFF_PASSWORD=<a strong password>
```

- Accounts are created at backend startup if they don't exist yet (emails must be exact `@usth.edu.vn` addresses; passwords 8+ characters).
- Existing accounts are never changed, so editing a password here later has no effect; change it in the app instead.
- If no active admin remains, the configured admin account is restored to admin at the next startup.

## Demo rooms, labs, and equipment

A new database has only 4 sample resources. For demos, import 42 fictional rooms, laboratories, and equipment items in 6 buildings, with varied capacities, opening hours, approval rules, statuses, and upcoming closures:

```bash
docker compose exec backend node dist/scripts/catalog-import.js           # import
docker compose exec backend node dist/scripts/catalog-import.js --clean   # remove
```

The data is in [`web-backend/src/scripts/demo-catalog.ts`](web-backend/src/scripts/demo-catalog.ts) and the script in [`catalog-import.ts`](web-backend/src/scripts/catalog-import.ts). It is safe to rerun, never touches users or bookings, and refuses to run in production. Rebuild the backend after changing the data. Details: [demo resource catalog](docs/MVP_RELEASE.md#demo-resource-catalog).

## Development without Docker

Requires Node.js 22+. From the repository root, start only PostgreSQL in Docker, then run each app in its own terminal:

```bash
docker compose up -d postgres

# Terminal 1: API
cd web-backend
npm install && cp .env.example .env
npm run migration:run
npm run start:dev

# Terminal 2: frontend
cd web-frontend
npm install && cp .env.example .env.local
npm run dev
```

Checks before opening a pull request:

```bash
(cd web-backend && npm run lint && npm test && npm run build)
(cd web-frontend && npm run lint && npm run typecheck && npm test && npm run build)
```
