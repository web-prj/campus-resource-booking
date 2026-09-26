# Performance comparison

This report compares performance before and after each optimization, and describes how the API behaves under load and under stress. It draws on two tools; their full output is in:

- [availability-query-benchmark.md](availability-query-benchmark.md) (run of 2026-09-25): the SQL behind search and the availability grid, timed inside PostgreSQL and through `ResourcesService`, with no HTTP.
- [load-test.md](load-test.md) (run of 2026-09-26): the built API (`dist/main.js`, `NODE_ENV=production`) driven over HTTP by simulated, logged-in students.

Both ran on the same dataset shape: 1,000 synthetic resources and 50,000 bookings over 60 days back and 30 days ahead, about 35,000 of which hold a slot. The machine was an 8-core Xeon E5-2686 v4 with PostgreSQL 16. How to rerun them: [README](README.md).

## Summary

| Metric | Before | After | Change |
| --- | ---: | ---: | ---: |
| Slot search, database time | 14–21 ms | 5–8 ms | 2.4–3.2× faster |
| Slot search, buffers read | ~2,400 | ~830 | about 3× fewer |
| Slot search, service p50 | 23–30 ms | 13–18 ms | 1.6–1.9× faster |
| API, 1 user, mixed reads: p95 | 58.2 ms | 34.6 ms | 1.7× faster |
| API, 1 user, mixed reads: throughput | 35.4 req/s | 49.9 req/s | +41% |
| API, 10 users, mixed reads: p95 / throughput | 75.7 ms / 247 req/s | 60.1 ms / 273 req/s | 1.3× / +11% |
| API, 50–100 users, mixed reads | ~260 req/s | ~260 req/s | no change (CPU-bound, see below) |
| `GET /resources/buildings`, cache: p95 / throughput | 115 ms / 467 req/s | 92 ms / 627 req/s | 1.2× / +34% |
| 100 simultaneous bookings of one slot, ×20 slots | — | exactly 1 booking per slot (20/20) | no double booking |
| Error rate, every stage up to 800 users | — | 0.00% | — |

"Before" for the index rows means the three booking lookup indexes from the migrations are dropped. The GiST exclusion constraint is always present. For the cache row, "before" means every request is a cache miss. The double-booking guarantee (a row lock plus the exclusion constraint) has existed since bookings were introduced, so it has no "before".

## 1. Database indexes

The migrations add three booking indexes: `IDX_bookings_resource_date`, `IDX_bookings_analytics_date_status_resource` and `IDX_bookings_operations_date_status`.

Without them, each "free at this time" search does a sequential scan of `bookings`. With them, the planner uses an index scan for the day's bookings and another for each resource on the page:

| Query (50,000 bookings) | Service p50, none → migrations | Database time | Buffers |
| --- | ---: | ---: | ---: |
| Free at slot | 24.9 → 15.4 ms (1.6×) | 17.5 → 5.4 ms | 2,479 → 828 |
| Slot + filters | 22.8 → 13.5 ms (1.7×) | 14.4 → 5.9 ms | 2,363 → 836 |
| Slot + text search | 30.3 → 18.5 ms (1.6×) | 21.1 → 8.1 ms | 2,473 → 828 |
| Slot, page 50 | 25.7 → 13.7 ms (1.9×) | 16.0 → 5.2 ms | 2,463 → 827 |
| Availability grid | 6.9 → 7.0 ms | 0.5 → 0.5 ms | 46 → 11 |

Through the full API, the gain is clear at low concurrency. One user sees p95 fall from 58 to 35 ms and completes 41% more requests per second. At 10 users the gain is 11% more throughput. From 50 users up, both variants deliver about 260 req/s with the same latency. The API process is then using a full CPU core, so time saved in PostgreSQL is not on the critical path: the request would have been waiting for the Node.js thread anyway.

Two further candidate indexes were benchmarked and rejected. They saved 0–2 ms, which is within noise, and would add write cost to every booking.

## 2. Response cache

`GET /resources/buildings` goes through Nest's `CacheInterceptor`, with a 5-minute TTL. At 50 users, cache hits raise throughput from 467 to 627 req/s and lower p95 from 115 to 92 ms.

The gain is modest because the cache sits after the guards. A cache hit still pays for:
- JWT verification
- the per-request user lookup, which lets a deactivated account lose access immediately
- the rate limiter
- the Express pipeline

The profile below shows that these fixed costs are most of a cheap request.

## 3. Load test

This is the mixed read workload of a student looking for a room: 40% slot searches, 25% availability grids, 15% catalog pages, 10% resource details, 7% "my bookings" and 3% buildings. It uses the current indexes, closed-loop users, and no think time.

| Virtual users | Throughput | p50 | p95 | p99 | Errors | API CPU |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 49.9 req/s | 18.4 ms | 34.6 ms | 39.1 ms | 0.00% | 52% |
| 10 | 273 req/s | 36.0 ms | 60.1 ms | 69.4 ms | 0.00% | 103% |
| 50 | 257 req/s | 194 ms | 235 ms | 260 ms | 0.00% | 106% |
| 100 | 262 req/s | 376 ms | 436 ms | 471 ms | 0.00% | 107% |

Writes and logins, run as separate stages:

- **Booking writes** (distinct free slots, 50 users): 284 bookings/s, p95 202 ms, all 4,290 created.
- **Double-booking storm:** 100 students booked the same slot at the same moment, for 20 different slots. For every slot, exactly one request got 201 and the other 99 got 409, and the database holds exactly one booking per slot. p95 was 771 ms, because the requests for one slot queue on the resource's row lock.
- **Logins** (200 students, 50 at a time): 48 logins/s, p95 1.1 s. bcrypt dominates. The run hashed its passwords at cost 10, while production uses `AUTH_BCRYPT_ROUNDS=12`, which is 4× more work, so expect about 12 logins/s. That limit is intended: it slows password guessing.

## 4. Stress test

The same read mix, raising the number of users until p95 passes 2 s:

| Virtual users | Throughput | p50 | p95 | Errors | API memory |
| --- | ---: | ---: | ---: | ---: | ---: |
| 50 | 203 req/s | 242 ms | 310 ms | 0.00% | 400 MB |
| 100 | 238 req/s | 415 ms | 479 ms | 0.00% | 400 MB |
| 200 | 251 req/s | 769 ms | 860 ms | 0.00% | 400 MB |
| 400 | 226 req/s | 1.65 s | 1.90 s | 0.00% | 407 MB |
| 800 | 203 req/s | 3.34 s | 3.70 s | 0.00% | 452 MB |

- **Capacity** is about 250 req/s of mixed reads for one API process. Beyond about 10 concurrent users, extra load adds queueing, not throughput: latency grows in proportion to users (800 users at 203 req/s gives about 3.9 s, close to the measured p50 of 3.3 s).
- **It degrades without failing.** At 800 users there were no errors, timeouts, crashes or dropped connections, and memory stayed under 460 MB. Throughput sags about 20% past 200 users, from scheduling and garbage-collection overhead.
- **In practice:** with p95 under 500 ms as the target, one process handles about 100 users who send requests back to back. Real students pause between clicks. Assuming about one request every 10 s per active student, 250 req/s corresponds to roughly 2,500 students active at the same time. This is an estimate, not a measurement.
- This stage ran after the write and cache stages, which left about 4,300 extra bookings and several thousand cache entries behind. Its throughput is therefore 10–20% lower than in section 3 at the same concurrency, so compare within a table, not across tables.
- **Rate limiting still works under load.** Restarted with the default limit of 100 requests per minute, the API served exactly 100 of 150 rapid requests from one client and answered the other 50 with 429.

## 5. Where the time goes

A V8 CPU profile of the API under 50 users shows the Node.js thread at about 96% busy. It was taken once, separately, with the Node.js inspector attached to the same seeded data; `npm run load:test` does not record it. Shares of that busy time:

| Share of API CPU | Mixed reads | Cached `GET /resources/buildings` |
| --- | ---: | ---: |
| Node.js core: HTTP parsing and writing, sockets, buffers, crypto | 32% | 42% |
| TypeORM: query building, entity mapping | 26% | 11% |
| Express, router, Nest core, Helmet, cache interceptor | 13% | 23% |
| `pg` driver: protocol, row and date parsing | 11% | 4% |
| Auth: Passport, JWT libraries | 4% | 8% |
| Validation: class-validator, class-transformer | 2% | — |
| Rate limiter: `@nestjs/throttler` | 2% | 3% |
| Garbage collection | 4% | 4% |
| Other: V8 internals, app code | 6% | 5% |

These shares are approximate: time is grouped by the package its code lives in, and native work counts toward the nearest JavaScript caller. On the cached route, about 4 points of the Node.js core share are JWT key setup (`createPublicKey`), which is triggered by `jsonwebtoken`.

PostgreSQL is not the bottleneck. With the indexes, the database spends about 5–8 ms on a slot search, and it works in parallel with the Node.js thread.

## What would help next

Most useful first. None of these is implemented.

1. **Run more than one API process.** The host has 8 cores and the API uses one; Node.js cluster mode or several Compose replicas behind a proxy would multiply throughput. First move the shared in-memory state to Redis: the rate-limit counters, the response cache and the Socket.IO adapter. Otherwise limits and cached data would be per process and real-time events would reach only some clients.
2. **Cut the fixed cost of every request.**
   - `jsonwebtoken` 9 rebuilds the HMAC key from the secret string on every verification, first attempting `createPublicKey` and catching the error. That costs about 4% of API CPU on cheap requests; passing a prebuilt `KeyObject` as the secret avoids it.
   - The per-request user lookup could be cached for a few seconds. That trades immediate deactivation for speed, so it needs a product decision.
3. **Reduce ORM work on the hottest reads.** The slot search issues three queries through `getManyAndCount` and maps full entities. A hand-written query that returns only the listed columns would cut the largest CPU share.
4. **Keep the current indexes; don't add more.** Further booking indexes save under 2 ms and would add write cost.

## Limits of these numbers

- The load generator ran on the same host as the API and database and shared its CPUs; the host is also shared with other users. Each result comes from one run, with the index comparison pooled over two rounds in alternating order. Differences under about 10% are within run-to-run noise.
- Users send requests back to back, so the throughput and latency figures are for saturation, not typical traffic.
- All users come from one IP address, so the rate limit was raised for every stage except the rate-limit check.
- The dataset is synthetic. Real booking patterns may cluster on popular rooms and hours, which would mostly affect lock contention on writes.
