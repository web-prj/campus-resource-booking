# Presentation kit

Material for a 5-minute presentation of Campus Resource Booking. The diagrams are written in [Mermaid](https://mermaid.js.org/) and render directly on GitHub and in VS Code with a Mermaid preview extension. For slides, screenshot them or paste the code into [mermaid.live](https://mermaid.live) and export PNG or SVG.

| File | Contents |
| --- | --- |
| [1-system-overview.md](1-system-overview.md) | Roles, use-case diagram, features by role, booking lifecycle, main flow |
| [2-architecture-and-api.md](2-architecture-and-api.md) | Architecture, request pipeline, data model, API tables, real-time events, performance |
| [3-screens.md](3-screens.md) | Screen map per role and wireframes of the main screens |

## 5-minute talk plan

About 7 slides at 30–60 seconds each. The quotes are suggested wording; shorten as needed.

| # | Time | Slide | Show | Say |
| --- | --- | --- | --- | --- |
| 1 | 0:00–0:30 | **Title and problem** | Name, team, one campus photo or screenshot | "Booking rooms and labs at USTH by message or on paper leads to double bookings and lost requests. We built one system where students book, staff approve, and admins see the usage." |
| 2 | 0:30–1:15 | **Roles and use cases** | Use-case diagram ([1](1-system-overview.md#use-cases)) | "There are three roles. Students search, book and check in. Staff approve and run check-in and check-out. Admins manage resources and users, and read the analytics." |
| 3 | 1:15–2:00 | **Features by role** | Booking lifecycle diagram ([1](1-system-overview.md#a-bookings-life)) | "A booking is confirmed right away, or waits for staff approval. The student gets a 6-digit code 15 minutes before the start; staff confirm it, then check the student out." |
| 4 | 2:00–3:00 | **Demo or screens** | Live demo, or wireframes ([3](3-screens.md)) | Search for a free lab → book it → staff approve → the student refreshes "My bookings" and sees Confirmed. Keep a second browser open on the same resource and day: the booked hour disappears from its grid without a refresh. |
| 5 | 3:00–3:45 | **Architecture and API** | Architecture diagram and the request pipeline ([2](2-architecture-and-api.md)) | "Next.js front end, NestJS API, PostgreSQL, all in Docker Compose. Every request passes rate limiting, a login check, a role check and input validation." |
| 6 | 3:45–4:40 | **Technical highlights** | "More than CRUD" table ([1](1-system-overview.md#what-makes-it-more-than-a-crud-app)) and the performance table ([2](2-architecture-and-api.md#performance-in-one-table)) | "When 100 students book the same slot at once, exactly one succeeds; the database guarantees it. Indexes make search about 1.7× faster, WebSockets keep availability live, and the API handled 800 simultaneous users without an error." |
| 7 | 4:40–5:00 | **Wrap-up** | Three bullets: complete for all 3 roles · safe under concurrency · measured performance | "Thank you. Questions?" |

## Preparing the live demo

1. Start everything with `docker compose up -d --build` (see the [root README](../../README.md)).
2. Set the admin and staff accounts in `.env` (`BOOTSTRAP_ADMIN_*`, `BOOTSTRAP_STAFF_*`) before starting.
3. Load demo rooms, labs and equipment: `docker compose exec backend node dist/scripts/catalog-import.js`.
4. Register one student account beforehand, and pick a resource that **requires approval**, so the staff step shows.
5. Keep two browser windows side by side, one normal and one private, both on the same resource and day, to show the live update.
6. Fallback if the demo fails: the wireframes in [3-screens.md](3-screens.md) and the sequence diagram in [1-system-overview.md](1-system-overview.md#main-flow-from-search-to-check-in).

## Likely questions

- **How do you stop double booking?** The API locks the resource row while booking. PostgreSQL also has an *exclusion constraint* that refuses any two slot-holding bookings that overlap on the same resource, so it holds even if the code had a bug.
- **Why a cookie instead of storing the token in the browser?** An `httpOnly` cookie cannot be read by JavaScript, so an injected script cannot steal the session.
- **How is it real-time?** Socket.IO. Clients join a room for the resource and day they are viewing, and the server pushes an event when a booking changes it.
- **How fast is it?** About 250 requests per second on one API process, with 0 errors up to 800 simultaneous users. Details: [performance comparison](../benchmarks/performance-comparison.md).
- **What would you improve?** Run several API processes, with Redis for the shared cache, rate limits and WebSocket events; add QR check-in; add email notifications.
