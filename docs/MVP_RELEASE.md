# MVP Release Runbook

This runbook is the release gate for Campus Resource Booking. Run it from a clean checkout of the commit being released.

## 1. Automated quality gate

```bash
cd web-backend
npm ci
npm test -- --runInBand
npm run build
npx --no-install eslint "{src,apps,libs,test}/**/*.ts"

cd ../web-frontend
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

The protected `main` branch also requires GitHub checks named `Frontend`, `Backend`, `Backend E2E`, and `CodeQL`.

## 2. Database and migration gate

Use a disposable migrated PostgreSQL database:

```bash
cd web-backend
npm run migration:run
npm run migration:revert
npm run migration:run
npm run typeorm -- schema:log
npm run test:e2e -- --runInBand
```

Required result: TypeORM reports `Your schema is up to date` and every E2E suite passes. Review new migrations for destructive statements and verify each entity index has a migration counterpart.

## 3. API documentation review

Start the non-production backend and open:

- `http://localhost:18320/api/docs`
- `http://localhost:18320/api/docs-json`

Confirm the OpenAPI document includes authentication, resources, bookings, staff operations, admin resources, admin users, admin analytics, and health endpoints. Production intentionally disables Swagger.

## 4. Docker deployment gate

```bash
cp .env.example .env
openssl rand -base64 48
# Put the generated value in AUTH_JWT_SECRET.

docker compose config --quiet
docker compose build backend frontend
docker compose up -d
for service in postgres backend frontend; do
  docker inspect --format '{{.State.Health.Status}}' "$(docker compose ps -q "$service")"
done
```

All services must report `healthy`. The backend applies pending migrations before it starts. Verify restart idempotency:

```bash
docker compose restart backend
docker compose logs --since=2m backend
```

The log should state that no migrations are pending before NestJS starts.

## 5. Demo data

Demo data is local-only, disposable, and blocked when `NODE_ENV=production`. It uses a password supplied at execution time and never stores that password in the repository.

For a backend running locally against the Compose PostgreSQL port:

```bash
cd web-backend
set -a; . ./.env; set +a
DEMO_PASSWORD='choose-a-local-demo-password' npm run demo:seed
```

The seed is idempotent: rerunning it removes and recreates only `demo.*@usth.edu.vn` accounts and `DEMO-*` resources. It provides:

- Student: `demo.student@usth.edu.vn`
- Staff: `demo.staff@usth.edu.vn`
- Admin: `demo.admin@usth.edu.vn`
- A pending approval request
- Completed student history
- A current confirmed visit when seeded before 23:00 ICT
- Room, laboratory, and equipment inventory for analytics

Remove it after the demonstration:

```bash
npm run demo:clean
```

For a fully containerized stack, run the TypeScript seed from the checked-out backend on the host, pointed at `localhost:${DB_HOST_PORT:-18322}`. The production runtime image intentionally excludes development tools such as `ts-node`.

### Demo resource catalog

A larger, fictional catalog for demonstrating search, filters, availability, and approvals lives in `web-backend/src/scripts/demo-catalog.ts`: 42 resources (15 rooms, 17 laboratories, 10 equipment items) in 6 buildings (`LHC`, `LCM`, `SIC`, `EWB`, `SEO`, `SMH`). It mixes approval rules, capacities from 1 to 450, operating days and hours, and includes 2 `maintenance` and 1 `inactive` resource. It also adds 8 upcoming closures, dated relative to the campus date of the import (Asia/Ho_Chi_Minh) and moved to the resource's next operating day. It creates no users or bookings and can be combined with `demo:seed`.

Local backend against the Compose PostgreSQL port:

```bash
cd web-backend
set -a; . ./.env; set +a
npm run catalog:import
```

Inside the running Compose backend container, which runs compiled code and receives its database settings from Compose (rebuild the image after pulling catalog changes):

```bash
docker compose exec backend node dist/scripts/catalog-import.js
docker compose exec backend node dist/scripts/catalog-import.js --clean
```

Remove it after the demonstration:

```bash
npm run catalog:clean
```

Behaviour:

- Checks the whole dataset before it connects to the database, and exits non-zero with a list of problems if the data is invalid. Refuses to run when `NODE_ENV=production`.
- Runs in one transaction and can be run again safely. Buildings are upserted by code. Resources are inserted, or refreshed by code unless they have a `pending`, `confirmed`, or `checked_in` booking; those are skipped and listed. Closures are added only on dates without an active booking for that resource, and an existing closure is never duplicated.
- `--clean` deletes catalog resources that have no bookings at all, together with their closures, and then catalog buildings that no longer have resources. Resources with booking history and their buildings are kept and listed.
- It only touches the catalog codes above. It never modifies migration sample rows (`MAIN`, `LAB`, `ROOM-A101`, …), `DEMO-*` rows, users, or bookings. Closures from earlier runs on other dates stay until `--clean`.

## 6. Browser smoke matrix

Use the Playwright CLI instructions in `AGENTS.md`. Exercise real actions, not page loads only.

### Student

1. Register or sign in.
2. Search by date/time and inspect live availability.
3. Book an available resource.
4. Confirm pending or confirmed state and history.
5. During the 15-minute check-in window, generate a code.
6. After staff check-out, confirm completed history.

### Staff

1. Review the oldest pending request.
2. Approve one request and reject another with a reason.
3. Verify a student code, confirm check-in, and check out.
4. Verify empty operations and approval states.

### Admin

1. Create/edit a resource, change status, and manage a closure.
2. Search a user, change a role, deactivate/reactivate the account.
3. Filter analytics by date and verify empty/populated ranges.

For every role, test representative desktop and 390px mobile widths, keyboard focus, 44px+ primary targets, reduced motion, horizontal overflow, console errors, and failed requests. Delete temporary accounts/bookings/resources and close browser sessions afterward.

## 7. Final release checks

```bash
git status --short
git diff --check
rg -n "BEGIN (RSA|OPENSSH|EC|PRIVATE) KEY|AUTH_JWT_SECRET=" . \
  --glob '!**/node_modules/**' --glob '!**/.next/**' --glob '!**/dist/**'
```

Confirm:

- No secrets, cookies, generated browser artifacts, or temporary users remain.
- Package locks match package manifests.
- The root README documents the service URLs and Docker commands.
- `.env` is ignored and deployment secrets come from the deployment platform.
- PostgreSQL has a successful off-host backup and isolated restore drill using the procedure in [DEPLOYMENT.md](DEPLOYMENT.md) before production data is introduced.

## Rollback

Application rollback means deploying the previous known-good image/commit. Database rollback must be assessed migration by migration: lifecycle migrations intentionally refuse to revert when doing so would destroy existing records. Never run `migration:revert`, reset a database, or delete a volume in production without a reviewed backup and rollback plan.
