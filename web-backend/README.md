# web-backend

Backend for **Campus Resource Booking** — a university room and equipment
reservation system. Built with [NestJS](https://nestjs.com/) and **PostgreSQL**
via [TypeORM](https://typeorm.io/).

## Features

- NestJS 10 with a modular, feature-based structure
- PostgreSQL via TypeORM (`@nestjs/typeorm`)
- Typed, namespaced environment configuration (`@nestjs/config` + Joi)
- Database migrations (no `synchronize` in production)
- **Cookie-based sessions**: the JWT is delivered in an `httpOnly` cookie, never
  in the response body
- **Secure by default**: authentication is applied globally; routes opt out with
  `@Public()`
- Role-based access control (`student` / `staff` / `admin`) via `@Roles(...)`
- Access restricted to **`@usth.edu.vn`** email addresses
- Rate limiting, `helmet` security headers, and credentialed CORS
- OpenAPI docs at `GET /api/docs` (non-production only)
- Health checks (`@nestjs/terminus`) at `GET /api/health`
- ESLint + Prettier, Jest unit & e2e tests
- Root Docker Compose stack runs PostgreSQL, backend, and frontend together

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Set a real `AUTH_JWT_SECRET` (minimum 32 characters):

```bash
openssl rand -base64 48
```

### 3. Start PostgreSQL and apply migrations

From the repository root, start PostgreSQL:

```bash
docker compose up -d postgres
```

Then return to `web-backend/` and apply migrations:

```bash
npm run migration:run
```

Or point `.env` at an existing PostgreSQL instance.

### 4. Run the app

```bash
npm run start:dev
```

The API is at `http://localhost:18320/api`, with docs at
`http://localhost:18320/api/docs`.

## Running with Docker

Docker configuration is owned by the repository root. The combined stack builds
and starts PostgreSQL, this API, and the Next.js frontend; pending migrations run
automatically before the API starts:

```bash
cd ..
cp .env.example .env
# Replace AUTH_JWT_SECRET in .env with: openssl rand -base64 48
docker compose up -d --build
```

See the root `README.md` and `compose.yaml` for service URLs, configuration, logs,
and shutdown commands.

## Authentication

The signed JWT is set as an `httpOnly`, `SameSite=Lax` cookie. Browser
JavaScript cannot read it, which removes the XSS token-theft exposure that comes
with storing tokens in `localStorage`. Clients never handle the token: they just
send requests with credentials included.

Access is restricted to the **`@usth.edu.vn`** domain, enforced by the
`IsStudentEmail` validator on both registration and login. Any other domain,
including subdomains such as `x@mail.usth.edu.vn`, is rejected with `400`.

| Method | Route                | Auth   | Description                               |
| ------ | -------------------- | ------ | ----------------------------------------- |
| `POST` | `/api/auth/register` | Public | Create an account and start a session     |
| `POST` | `/api/auth/login`    | Public | Exchange credentials for a session cookie |
| `POST` | `/api/auth/logout`   | Cookie | Clear the session cookie (`204`)          |
| `GET`  | `/api/auth/me`       | Cookie | Return the authenticated user             |

```bash
# Register — the cookie is stored in cookies.txt; the body holds only the user
curl -c cookies.txt -X POST http://localhost:18320/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"nam.tran@usth.edu.vn","password":"password123","fullName":"Nam Tran"}'

# Log in
curl -c cookies.txt -X POST http://localhost:18320/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"nam.tran@usth.edu.vn","password":"password123"}'

# Call a protected route with the stored cookie
curl -b cookies.txt http://localhost:18320/api/auth/me

# Log out
curl -b cookies.txt -X POST http://localhost:18320/api/auth/logout
```

From the companion frontend at `http://localhost:18321`, send
`credentials: 'include'`. That origin is allowed by default; set `CORS_ORIGINS`
to explicit comma-separated origins for other deployments. A wildcard is not
usable with credentialed requests.

### Frontend example

```ts
await fetch('http://localhost:18320/api/auth/login', {
  method: 'POST',
  credentials: 'include', // required, both to store and to send the cookie
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});

const me = await fetch('http://localhost:18320/api/auth/me', {
  credentials: 'include',
}).then((res) => res.json());
```

### Cross-site deployments

When the frontend is on a different site than the API, set
`AUTH_COOKIE_SAME_SITE=none` and `AUTH_COOKIE_SECURE=true` (HTTPS required).
Startup validation rejects `none` without `secure`, because browsers silently
discard such cookies.

### Protecting routes

Authentication is global, so a new controller is protected the moment it is
added. Mark exceptions explicitly:

```ts
@Public()                      // no session required
@Get('resources')
findAll() {}

@Roles(UserRole.ADMIN)         // session required, admin only
@Post('resources')
create() {}

@Get('bookings')
findMine(@CurrentUser('id') userId: string) {}
```

Passwords are hashed with bcrypt (cost `AUTH_BCRYPT_ROUNDS`, default 12) and the
hash is excluded from queries by default. Tokens and cookies share one lifetime
(`AUTH_TOKEN_EXPIRES_IN`), so they cannot drift apart.

## Project structure

```
src/
├── auth/                  # Sessions, cookies, guards, roles, @usth.edu.vn rule
│   ├── decorators/        # @Public, @Roles, @CurrentUser
│   ├── dto/
│   ├── guards/            # JwtAuthGuard (global), RolesGuard
│   ├── interfaces/
│   ├── services/          # Cookie, password, and token concerns
│   └── strategies/        # Reads the JWT from the cookie
├── common/                # Cross-cutting helpers
│   ├── decorators/        # Input normalisation
│   ├── utils/
│   └── validators/
├── config/                # Namespaced, typed, validated configuration
├── database/              # TypeORM setup, data source, migrations
├── health/                # Health-check endpoint
├── throttler/             # Rate-limit configuration
├── users/                 # User entity, roles, persistence
├── app.module.ts          # Root module, global guards
└── main.ts                # Bootstrap: cookies, helmet, CORS, validation
```

Each feature module owns its entity, DTOs, service, and controller. Shared
concerns live in `common/`, and every environment value is declared in
`config/`, so nothing reads `process.env` at runtime.

## Configuration

All variables are validated at boot, so a missing or malformed value fails
immediately instead of at the first request. See `.env.example` for the full
list.

| Variable                | Default          | Purpose                                  |
| ----------------------- | ---------------- | ---------------------------------------- |
| `AUTH_JWT_SECRET`       | —                | Signing key, minimum 32 chars (required) |
| `AUTH_TOKEN_EXPIRES_IN` | `1d`             | Token _and_ cookie lifetime              |
| `AUTH_COOKIE_NAME`      | `access_token`   | Session cookie name                      |
| `AUTH_COOKIE_SAME_SITE` | `lax`            | `lax`, `strict`, or `none`               |
| `AUTH_COOKIE_SECURE`    | prod: `true`     | HTTPS-only cookie                        |
| `AUTH_BCRYPT_ROUNDS`    | `12`             | Password hashing cost                    |
| `CORS_ORIGINS`          | `localhost:18321` | Comma-separated allowed origins          |
| `THROTTLE_LIMIT`        | `100`            | Requests per window                      |
| `AUTH_THROTTLE_LIMIT`   | `10`             | Tighter budget for login/register        |

## Database migrations

```bash
# Generate a migration from entity changes
npm run migration:generate -- src/database/migrations/MigrationName

# Create an empty migration
npm run migration:create src/database/migrations/MigrationName

# Apply migrations
npm run migration:run

# Revert the last migration
npm run migration:revert
```

> Migrations are the source of truth for the schema. `synchronize` is disabled
> by default — keep it that way outside of throwaway local experiments.

## Testing

Unit tests run without external services. The e2e suite needs PostgreSQL and
reads `.env.test`, which is committed with throwaway local values; real
environment variables override it.

```bash
npm run test           # unit
npm run test:e2e       # end-to-end (requires a migrated database)
npm run test:cov       # coverage
```

## Scripts

| Script                  | Description                       |
| ----------------------- | --------------------------------- |
| `npm run start:dev`     | Start in watch mode               |
| `npm run start:prod`    | Run the compiled build            |
| `npm run build`         | Compile to `dist/`                |
| `npm run lint`          | Lint and auto-fix                 |
| `npm run test`          | Unit tests                        |
| `npm run test:e2e`      | End-to-end tests                  |
| `npm run migration:run` | Apply pending database migrations |

## Adding a feature module

```bash
npx nest generate resource bookings
```

Follow the conventions already in `src/`: keep HTTP concerns in the controller,
business rules in the service, and expose data through a response DTO with a
`fromEntity` mapper so internal columns are never returned by accident.
