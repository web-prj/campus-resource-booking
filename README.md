# Campus Resource Booking

A full-stack USTH application for finding, reserving, approving, and managing university rooms, laboratories, and equipment.

## Repository structure

- `web-frontend/` — Next.js 16 and React 19, served on port `18321`.
- `web-backend/` — NestJS 11, TypeORM, and PostgreSQL, served on port `18320` under `/api`.
- `docs/` — project proposal and supporting documentation.
- `compose.yaml` — combined PostgreSQL, backend, and frontend stack.
- `Dockerfile` — multi-stage, multi-target build for both applications.

## Requirements

For the complete containerized stack:

- Docker Engine
- Docker Compose v2 (`docker compose`, not the legacy `docker-compose` command)
- OpenSSL, or another secure secret generator, for creating the JWT secret

For running applications outside Docker, install Node.js 22+ and npm.

## Quick start with Docker

### 1. Create the environment file

From the repository root:

```bash
cp .env.example .env
openssl rand -base64 48
```

Put the generated value in `AUTH_JWT_SECRET` inside `.env`. Do not use the example secret outside disposable local development.

The default configuration exposes:

| Service | Host address | Container port |
| --- | --- | --- |
| Frontend | `http://localhost:18321` | `18321` |
| Backend API | `http://localhost:18320/api` | `18320` |
| API documentation | `http://localhost:18320/api/docs` | `18320` |
| PostgreSQL | `localhost:18322` | `5432` |

### 2. Build and start the stack

```bash
docker compose up -d --build
```

Use this command for the first startup, after pulling application changes, after changing the `Dockerfile`, or after changing `NEXT_PUBLIC_API_URL`.

Startup order is managed automatically:

1. PostgreSQL starts and must pass a real database query.
2. The backend applies pending TypeORM migrations and starts NestJS.
3. The backend health endpoint must pass.
4. The Next.js frontend starts.

### 3. Verify the services

```bash
docker compose ps
curl http://localhost:18320/api/health
```

All three services should eventually show `healthy`. Initial startup can take longer because images may need to build and database migrations may need to run.

Follow startup logs if a service remains in `starting` or `unhealthy`:

```bash
docker compose logs -f postgres backend frontend
```

Press `Ctrl+C` to stop following logs. This does not stop the containers.

## Docker lifecycle commands

Compose commands are preferred because they understand this application's services, network, volume, health checks, and dependency order.

### Start or create the stack: `docker compose up`

```bash
docker compose up -d
```

Use `up` when containers do not exist yet or when Compose configuration may have changed. It creates missing containers and starts existing ones. `-d` runs them in the background.

```bash
docker compose up -d --build
```

Add `--build` after source code, dependencies, build arguments, or Docker configuration changes. Without `--build`, Compose may reuse an existing image.

To rebuild only one application:

```bash
docker compose build backend
docker compose up -d backend

# Or:
docker compose build frontend
docker compose up -d frontend
```

When rebuilding the frontend, remember that `NEXT_PUBLIC_API_URL` is embedded during `next build`. Change it in `.env`, then rebuild the frontend image:

```bash
docker compose build frontend
docker compose up -d frontend
```

### Stop containers without removing them: `docker compose stop`

```bash
docker compose stop
```

Use `stop` when pausing local work and you expect to resume with exactly the same containers. It gracefully stops the frontend, backend, and database but keeps:

- Containers
- The Compose network
- Built images
- PostgreSQL data

Stop one service only when debugging or maintaining it:

```bash
docker compose stop frontend
docker compose stop backend
```

Stopping PostgreSQL also makes the backend unhealthy or unavailable, so normally stop the full stack rather than PostgreSQL alone.

### Start previously stopped containers: `docker compose start`

```bash
docker compose start
```

Use `start` only after `docker compose stop`, when the containers already exist and neither the Compose configuration nor images need to change. It is faster than `up`, but it does **not**:

- Create missing containers
- Recreate containers after configuration changes
- Rebuild images
- Apply changed environment values to existing containers

If code, `.env`, `compose.yaml`, or images changed, use `docker compose up -d --build` instead.

### Restart running containers: `docker compose restart`

```bash
docker compose restart
```

Use `restart` to stop and start existing containers without recreating them. This is useful for testing startup behavior or recovering a process that is temporarily stuck.

Restart a single service:

```bash
docker compose restart backend
```

A backend restart reruns the migration command safely; already-applied migrations are skipped. `restart` does not rebuild an image and does not apply changed Compose environment settings. Use `docker compose up -d --build` for those changes.

### Remove containers but keep database data: `docker compose down`

```bash
docker compose down
```

Use `down` when you want a clean set of containers next time. It removes the Compose containers and network but preserves the named PostgreSQL volume by default.

Start again with:

```bash
docker compose up -d
```

### Delete the database volume: `docker compose down -v`

```bash
docker compose down -v
```

**Destructive:** this removes the PostgreSQL volume and permanently deletes local users, resources, bookings, and migration history stored in it.

Use it only when you intentionally want a completely fresh local database. The next `docker compose up -d` initializes PostgreSQL and reapplies every migration.

## Low-level `docker start` and `docker stop`

Docker also provides commands that operate directly on container IDs or names:

```bash
docker stop campus-resource-booking-frontend-1
docker start campus-resource-booking-frontend-1
```

Use these only for targeted container-level debugging. Prefer `docker compose stop frontend` and `docker compose start frontend` for normal work because Compose commands are clearer and remain tied to service names.

List the generated container names first:

```bash
docker compose ps -a
```

You can stop or start all existing project containers by ID:

```bash
docker stop $(docker compose ps -q)
docker start $(docker compose ps -a -q)
```

These low-level commands do not create containers, rebuild images, apply changed configuration, or wait for Compose health dependencies in application order. In particular, starting all containers directly may start the backend before PostgreSQL is ready. Use `docker compose up -d` when dependency ordering matters.

## Inspecting and operating the stack

### Service status

```bash
docker compose ps
docker compose ps -a
```

- `ps` shows running project containers.
- `ps -a` also shows stopped or failed project containers.

### Logs

```bash
# All services
docker compose logs

# Follow application logs
docker compose logs -f backend frontend

# Last 100 backend lines
docker compose logs --tail=100 backend

# Logs from the last five minutes
docker compose logs --since=5m backend
```

### Run a command inside a container

```bash
docker compose exec backend sh
docker compose exec frontend sh
docker compose exec postgres sh -c \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

`docker compose exec` requires the target container to be running. Use `-T` in scripts and CI to disable pseudo-TTY allocation:

```bash
docker compose exec -T backend node --version
```

### Run database migrations manually

The backend image automatically runs pending migrations before NestJS starts. To check or apply migrations manually in a running backend container:

```bash
docker compose exec backend \
  node node_modules/typeorm/cli.js migration:run \
  -d dist/database/data-source.js
```

Normally this is unnecessary. It is useful when diagnosing migration state without restarting the backend.

### Inspect rendered Compose configuration

```bash
docker compose config
docker compose config --quiet
```

Use this after editing `.env` or `compose.yaml` to see interpolated values and catch invalid Compose syntax. The rendered output may contain secrets from `.env`; do not publish it.

### Check health directly

```bash
curl http://localhost:18320/api/health

docker inspect \
  --format '{{json .State.Health}}' \
  "$(docker compose ps -q backend)"
```

The PostgreSQL health check executes a query against the configured database. This avoids reporting healthy when PostgreSQL is running but `DB_NAME` does not exist.

### View resource usage

```bash
docker stats
docker system df
```

Press `Ctrl+C` to exit `docker stats`.

## Database persistence and configuration changes

PostgreSQL stores data in the `postgres_data` named volume. `docker compose stop`, `start`, `restart`, and `down` preserve this volume. Only `docker compose down -v` or an explicit `docker volume rm` deletes it.

`POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` initialize a **new** PostgreSQL volume. Changing these variables later does not rename users or create a different database inside an already initialized volume.

If you intentionally change database initialization values for local development, either migrate the existing database manually or recreate it destructively:

```bash
docker compose down -v
docker compose up -d
```

Do not run this against data you need to keep.

## Common troubleshooting

### A service is unhealthy

```bash
docker compose ps
docker compose logs --tail=200 postgres backend frontend
```

Typical causes include:

- Invalid or missing `AUTH_JWT_SECRET`
- PostgreSQL credentials that do not match an existing volume
- A database name changed after the volume was initialized
- A failed migration
- Host ports already in use
- Incorrect browser-visible API or CORS origins

### A host port is already in use

Change the host-side values in `.env`:

```env
BACKEND_PORT=28320
FRONTEND_PORT=28321
DB_HOST_PORT=28322
NEXT_PUBLIC_API_URL=http://localhost:28320/api
CORS_ORIGINS=http://localhost:28321
```

Then recreate and rebuild the stack:

```bash
docker compose up -d --build
```

Container ports remain unchanged. Only the host-facing ports move.

### Frontend uses an old API URL

`NEXT_PUBLIC_API_URL` is a build argument and is embedded into browser code. Rebuild the frontend after changing it:

```bash
docker compose build --no-cache frontend
docker compose up -d frontend
```

`INTERNAL_API_URL` is set by Compose for Server Components and points to the backend over the private Compose network.

### Environment changes do not appear

`docker compose start` and `docker compose restart` reuse existing container configuration. Recreate affected containers:

```bash
docker compose up -d --force-recreate backend frontend
```

Add `--build` if application files or images also changed.

### Images or build cache consume too much disk

Inspect usage first:

```bash
docker system df
```

Remove only unused build cache:

```bash
docker builder prune
```

More aggressive commands such as `docker system prune` can delete unrelated stopped containers, networks, or images. Review the prompt carefully and do not add `--volumes` unless deleting unused volumes is intentional.

### Docker subnet conflicts with a VPN or host network

The project uses a dedicated private subnet to avoid exhausted Docker default address pools. If `10.203.250.0/24` conflicts with an existing route, set another unused `/24` in `.env`:

```env
DOCKER_SUBNET=10.203.251.0/24
```

Then recreate the Compose network:

```bash
docker compose down
docker compose up -d
```

Database data remains in the named volume.

## Production configuration

The default Compose configuration is intended for local HTTP development. For production:

- Terminate HTTPS at a trusted reverse proxy.
- Use a generated JWT secret.
- Enable secure cookies.
- Use exact frontend and API origins.
- Protect PostgreSQL from public exposure or remove its host port mapping.
- Back up the database volume.
- Use deployment-specific secret management instead of committing `.env`.

At minimum:

```env
NODE_ENV=production
AUTH_COOKIE_SECURE=true
CORS_ORIGINS=https://your-frontend.example
NEXT_PUBLIC_API_URL=https://your-api.example/api
```

Rebuild the frontend after changing `NEXT_PUBLIC_API_URL`:

```bash
docker compose build frontend
docker compose up -d
```

Cross-site session cookies are intentionally unsupported until unsafe requests have dedicated CSRF protection. Deploy the frontend and API on the same site.

## Release readiness

The complete MVP quality gate, migration review, demo-data procedure, role smoke matrix, cleanup checks, and rollback guidance are in [`docs/MVP_RELEASE.md`](docs/MVP_RELEASE.md).

Quick read-only smoke after the stack is healthy:

```bash
./scripts/release-smoke.sh
```

## Run applications locally without Docker

Install dependencies independently because there is no root application package:

```bash
cd web-backend && npm install
cd ../web-frontend && npm install
```

Start only PostgreSQL from the repository root:

```bash
cp .env.example .env
docker compose up -d postgres
```

Then configure and start each application in separate terminals:

```bash
cd web-backend
cp .env.example .env
npm run migration:run
npm run start:dev
```

```bash
cd web-frontend
cp .env.example .env.local
npm run dev
```

## Validation

```bash
cd web-backend
npm test
npm run build
npm run lint

cd ../web-frontend
npm run lint
npm run typecheck
npm test
npm run build
```

Backend end-to-end tests require a reachable, migrated PostgreSQL test database.
