# AGENTS.md

## Project overview

This repository contains **Campus Resource Booking**, a USTH web application for finding, reserving, approving, and managing university rooms, laboratories, and equipment.

Primary roles:
- **Student:** search, book, cancel, check in, and view booking history.
- **Staff:** approve or reject requests, confirm check-in/check-out, and resolve operational issues.
- **Admin:** manage users and resources and view utilization analytics.

The project proposal is in `docs/Campus_Resource_Booking_Project_Proposal_EN.docx`. Read it before making product-scope or architecture decisions.

## Repository layout

- `web-frontend/` — Next.js 16, React 19, TypeScript, App Router. Runs on port `3001`.
- `web-backend/` — NestJS 10, TypeORM, PostgreSQL. API runs on port `3000` under `/api`.
- `.pi/skills/frontend-design/SKILL.md` — project-specific USTH frontend design guidance.
- `docs/` — project proposal and supporting documentation.

There is no root application package. Run npm commands from the relevant subproject. `web-backend/` is its own Git worktree; do not assume the repository root or `web-frontend/` has the same Git state.

## Working principles

- Read existing code and nearby tests before editing.
- Make the smallest coherent change that fully solves the request.
- Preserve established module boundaries and naming conventions.
- Do not edit generated output or dependencies directly: `node_modules/`, `.next/`, `dist/`, coverage output, or `*.tsbuildinfo`.
- Do not create commits, push branches, or perform destructive Git operations unless explicitly requested.
- Never commit secrets, real credentials, access tokens, cookies, or production data. Use `.env.example` and placeholders.
- When adding a dependency, use npm in the owning subproject, pin the requested version, and update that subproject's lockfile.

## Frontend conventions

Work in `web-frontend/`.

Architecture:
- Routes and layouts live in `app/`.
- Reusable UI lives in `components/`.
- API, authentication, and shared types live in `lib/`.
- Prefer Server Components. Add `"use client"` only when browser state, effects, event handlers, or client-only APIs require it.
- Keep TypeScript strict. Avoid `any`; model API payloads explicitly.
- Follow the existing formatting style: double quotes, semicolons, and accessible semantic JSX.

Authentication and API:
- The API root comes from `NEXT_PUBLIC_API_URL`, defaulting to `http://localhost:3000/api`.
- Authentication uses an `httpOnly` cookie. Browser requests must use `credentials: "include"`.
- Never store or expose the JWT in frontend JavaScript, `localStorage`, `sessionStorage`, or response UI.
- Preserve safe internal redirect validation. Do not permit protocol-relative, external, backslash, or control-character redirects.
- User-facing claims must reflect implemented behavior. Do not label static sample data as live or real-time.

Design and accessibility:
- For any UI creation or review, first read and follow `.pi/skills/frontend-design/SKILL.md`.
- The USTH brand foundation is fixed: royal blue `#2A3C95`, red `#EC2227`, and white. Tonal variants and restrained semantic state colors are allowed; do not replace the brand palette.
- Preserve the requested glassmorphism direction, but use it hierarchically rather than applying identical glass cards everywhere.
- Make campus availability and booking the dominant visual language: rooms, labs, equipment, buildings, capacity, approvals, time slots, and statuses.
- Keep mobile task-first. Login, search, availability, and booking actions must appear before promotional content.
- Maintain visible keyboard focus, semantic headings and landmarks, labelled controls, sufficient contrast, readable mobile text, reduced-motion support, and accessible status/error messaging.
- Do not hide meaningful availability information from assistive technology.

Frontend commands:

```bash
cd web-frontend
npm install
cp .env.example .env.local
npm run dev
```

Validation:

```bash
cd web-frontend
npm run lint
npm run typecheck
npm test
npm run build
```

Run targeted tests first when available. For layout changes, smoke-test `/` and `/login` at desktop and mobile widths. A production build is required for routing, metadata, configuration, or deployment-sensitive changes.

## Backend conventions

Work in `web-backend/`.

Architecture:
- Organize code by feature module under `src/`.
- Keep HTTP concerns in controllers, business rules in services, persistence in feature repositories/services, and input validation in DTOs.
- Shared decorators, validators, and utilities belong in `src/common/`.
- Environment configuration belongs in `src/config/`. Do not read `process.env` directly in feature code.
- Return response DTOs such as `UserResponseDto`; never serialize entities with internal or sensitive columns by accident.
- Add Swagger decorators when adding or changing HTTP endpoints.
- Follow the existing formatting style: single quotes, trailing commas, NestJS decorators, and dependency injection.

Security invariants:
- Authentication is global. New routes are protected unless explicitly marked `@Public()`.
- Authorization uses `@Roles(...)`; do not implement ad hoc role checks in controllers.
- Only exact `@usth.edu.vn` addresses are accepted by the authentication DTOs.
- Password hashes remain excluded from normal entity queries and are selected only for credential verification.
- Login errors must not reveal whether an email is registered.
- JWTs are delivered only through the configured `httpOnly` cookie, never in response bodies.
- Credentialed CORS requires explicit origins. Never use `*` with cookies.
- Preserve Helmet, validation whitelisting, rate limiting, secure-cookie behavior, and proxy handling.

Database rules:
- PostgreSQL migrations are the schema source of truth.
- Keep `DB_SYNCHRONIZE=false` outside disposable local experiments.
- Entity changes that affect the schema require a migration.
- Review generated migrations before applying them. Do not drop data or reset databases without explicit approval.

Backend setup:

```bash
cd web-backend
npm install
cp .env.example .env
docker compose up -d postgres
npm run migration:run
npm run start:dev
```

Generate a real local JWT secret with `openssl rand -base64 48`; never use the example secret outside local development.

Backend validation:

```bash
cd web-backend
npm test
npm run build
npm run lint
```

`npm run lint` uses `--fix` and may modify files; inspect its changes. Run `npm run test:e2e` when endpoint, authentication, cookie, database, migration, guard, or integration behavior changes. E2E tests require a reachable migrated PostgreSQL database and use `.env.test` unless real environment variables override it.

Migration commands:

```bash
npm run migration:generate -- src/database/migrations/MigrationName
npm run migration:create src/database/migrations/MigrationName
npm run migration:run
npm run migration:revert
```

## Cross-stack contract

- Backend base URL: `http://localhost:3000/api`.
- Frontend URL: `http://localhost:3001`.
- Local backend CORS must include `http://localhost:3001`.
- Keep frontend types, error handling, and route usage aligned with backend DTOs and status codes.
- When changing an API contract, update backend DTO/controller/Swagger/tests and frontend types/client/UI in the same task when applicable.
- Preserve the complete authentication flow: normalized USTH email → validated credentials → `httpOnly` session cookie → credentialed frontend requests.

## Definition of done

Before reporting completion:
1. Review the diff for scope, generated files, secrets, and accidental dependency changes.
2. Run the smallest relevant tests for the changed behavior.
3. Run type checks and lint for the affected subproject.
4. Run the affected build when practical.
5. For cross-stack changes, validate both sides and smoke-test the user flow.
6. Report what changed, commands run, results, and any validation that could not be completed.
