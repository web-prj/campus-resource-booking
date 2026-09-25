# Benchmarks

## Availability queries

`npm run bench:availability` (in `web-backend/`) measures the queries behind resource search and the availability grid under different booking-index sets. The latest results are in [availability-query-benchmark.md](availability-query-benchmark.md), which the script rewrites on each run.

```bash
cd web-backend
npm run bench:availability -- --out ../docs/benchmarks/availability-query-benchmark.md
```

It needs a migrated PostgreSQL database and reads `.env.test` by default. The script:

- calls the real `ResourcesService` read paths (`discover`, `findAvailabilitySnapshot`), so the SQL under test is exactly what the API runs;
- seeds 1,000 synthetic resources and 50,000 bookings, covering 60 days back and 30 days ahead, in one transaction and **always rolls it back**, together with every index change;
- runs `VACUUM (ANALYZE)` on the touched tables before and after, so dead rows from earlier runs do not skew the scans and none are left behind;
- tries each index variant in a savepoint over several rounds, alternating the variant order, and records `EXPLAIN (ANALYZE, BUFFERS)` for every statement;
- checks that every variant returns identical results;
- runs only against a `*_test` database unless `--allow-any-database` is passed, because the index changes lock `bookings` for the whole run. It refuses `NODE_ENV=production`.

Options: `--resources`, `--bookings`, `--past-days`, `--future-days`, `--iterations`, `--warmup`, `--rounds`, `--explain-runs`, `--seed`, `--env`, `--out`.

### Findings (run of 2026-09-25)

Results are from 50,000 bookings on an 8-core Xeon E5-2686 v4 with PostgreSQL 16.

- **The indexes from the current migrations are what make slot search fast.** Without them, every "free at this time" search does a sequential scan of `bookings`. With them, the planner uses `IDX_bookings_analytics_date_status_resource` for the day's bookings and `IDX_bookings_resource_date` for the per-resource checks. Service p50 drops from 23–30 ms to 13–18 ms (1.6–1.9×), database time from 14–21 ms to 5–8 ms, and buffers read from about 2,400 to about 830.
- **Neither candidate index is worth a migration.**
  - `IDX_bookings_availability_check` (booking date, status, times, resource) cuts buffers read by a further 3.5× (about 830 → 240). Its end-to-end gain is only 0–2 ms, and it was slightly slower on the deep-page query, all within run-to-run noise. The "browse" control reads no bookings, and it still varies by about 1.5 ms between variants.
  - A partial `(resource_id, booking_date, start_time, end_time)` index on blocking statuses allows index-only probes but shows the same small gain.
  - Each extra index adds write cost to every booking insert and status change.
- **The availability grid is already cheap**, at under 0.5 ms of database time under every variant. Even with no extra indexes, the GiST exclusion constraint serves the lookup.
- **Most of the remaining time is outside PostgreSQL.** The browse control spends about 4–6 ms in the database and 11–12 ms in total. Most of the gap is TypeORM query building, extra round trips (`getManyAndCount` with a join issues a page query, an entity query and a count) and entity mapping. Further gains would come from there, or from caching, rather than from more booking indexes.

`IDX_bookings_availability_check` exists only in the local `web_backend_test` database. It was created by hand during earlier manual benchmarking, and no migration defines it.
