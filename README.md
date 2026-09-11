# Campus Resource Booking

A full-stack USTH application for finding, reserving, approving, and managing university rooms, laboratories, and equipment.

## Repository structure

- `web-frontend/` — Next.js 16 and React 19, served on port `18321`.
- `web-backend/` — NestJS 10, TypeORM, and PostgreSQL, served on port `18320` under `/api`.
- `docs/` — project proposal and supporting documentation.
- `compose.yaml` — combined PostgreSQL, backend, and frontend stack.
- `Dockerfile` — multi-target build for both applications.

## Run the complete stack with Docker

Create the root environment file and replace the example JWT secret:

```bash
cp .env.example .env
openssl rand -base64 48
# Put the generated value in AUTH_JWT_SECRET inside .env.
```

Build and start all services:

```bash
docker compose up -d --build
```

The services are available at:

- Frontend: http://localhost:18321
- Backend API: http://localhost:18320/api
- API documentation: http://localhost:18320/api/docs
- PostgreSQL: `localhost:18322`

The backend waits for PostgreSQL, applies pending migrations, and then starts. The frontend waits for the backend health check. Compose uses the dedicated `10.203.250.0/24` private subnet so it does not depend on Docker's exhausted default address pools on busy hosts. If that subnet conflicts with a host route or VPN, set a different unused `/24` in `DOCKER_SUBNET`.

```bash
docker compose ps
docker compose logs -f backend frontend
docker compose down       # keep database data
docker compose down -v    # delete the database volume
```

If Docker reports `all predefined address pools have been fully subnetted`, confirm `.env` contains `DOCKER_SUBNET=10.203.250.0/24` and retry. The project network is explicitly allocated from that subnet; no global network pruning or Docker daemon restart is required.

The default Compose configuration is intended for local HTTP development. For production, terminate HTTPS at a trusted proxy and set at least:

```env
NODE_ENV=production
AUTH_COOKIE_SECURE=true
CORS_ORIGINS=https://your-frontend.example
NEXT_PUBLIC_API_URL=https://your-api.example/api
```

`NEXT_PUBLIC_API_URL` is embedded when the frontend image is built. Run `docker compose build frontend` after changing it. Server Components use the internal Compose URL `http://backend:18320/api` automatically.

## Run applications locally

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

Backend e2e tests require a reachable, migrated PostgreSQL test database.
