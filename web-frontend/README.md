# Campus Resource Booking — Frontend

A Next.js interface for discovering and booking USTH rooms, laboratories, and equipment. The current slice includes the public landing page, login flow, and a server-verified session handoff.

## Requirements

- Node.js 22+
- The companion NestJS API in `../web-backend`

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

The frontend runs at [http://localhost:3001](http://localhost:3001). The API defaults to `http://localhost:3000/api` and can be changed with `NEXT_PUBLIC_API_URL`.

The backend allows `http://localhost:3001` by default. Browser requests use `credentials: "include"`, while Server Components explicitly forward the incoming cookie for session checks. The token is never exposed to or stored by frontend JavaScript.

## Checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```
