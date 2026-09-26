# Availability query benchmark

Generated 2026-09-25T18:17:13.187Z by `npm run bench:availability` (web-backend). Re-run it to refresh this file; see the options in `src/scripts/availability-benchmark-runner.ts`.

The benchmark seeds a synthetic catalog and booking history inside one transaction, times the real `ResourcesService` read paths under several booking-index variants, and rolls everything back, so the database is left unchanged.

## Environment

| | |
|---|---|
| PostgreSQL | 16.15 |
| shared_buffers / work_mem | 128MB / 4MB |
| Node.js | v22.22.1 |
| CPU | 8 × Intel(R) Xeon(R) CPU E5-2686 v4 @ 2.30GHz |
| Load average at start | 2.49, 1.36, 1.32 |
| Method | 3 rounds (variant order alternates); per round, 5 warm-up + 40 timed calls and 5 EXPLAIN ANALYZE runs per scenario and variant |
| Managed indexes present before the run | `IDX_bookings_analytics_date_status_resource`, `IDX_bookings_availability_check`, `IDX_bookings_operations_date_status`, `IDX_bookings_resource_date` |

## Dataset

| | |
|---|---|
| Resources | 1004 (1000 synthetic) |
| Bookings | 50000 (34964 holding a slot) |
| Status mix | confirmed 22634, pending 12330, cancelled 10039, rejected 4997 |
| Booking window | 2026-07-28 to 2026-10-26 |
| Closures | 586 |
| bookings table + indexes | 26 MB |
| Random seed | 0.42 |
| Seed time | 8.0 s |

## Scenarios

- **discover: browse**: Catalog page 1 with no time slot (control; does not read bookings).
- **discover: free at slot**: Resources free on 2026-10-03 09:00-10:00, page 1 (the search page's main query).
- **discover: slot + filters**: Same slot, laboratories with capacity >= 30, sorted by capacity.
- **discover: slot + text search**: Same slot with the free-text search "lab".
- **discover: slot, deep page**: Same slot, page 50 (late pagination).
- **availability snapshot**: Slot grid for the busiest synthetic resource on 2026-10-03 (resource detail page).

## Index variants

- **none** (No booking lookup indexes): only the primary key, the GiST exclusion constraint and the pending-queue index
- **migrations** (Current migrations): `IDX_bookings_resource_date`, `IDX_bookings_analytics_date_status_resource`, `IDX_bookings_operations_date_status`
- **availability-check** (Migrations + IDX_bookings_availability_check): `IDX_bookings_resource_date`, `IDX_bookings_analytics_date_status_resource`, `IDX_bookings_operations_date_status`, `IDX_bookings_availability_check`
- **blocking-partial** (Migrations + IDX_bookings_blocking_resource_date): `IDX_bookings_resource_date`, `IDX_bookings_analytics_date_status_resource`, `IDX_bookings_operations_date_status`, `IDX_bookings_blocking_resource_date`

## Results

Service times are wall-clock milliseconds per call through `ResourcesService` (TypeORM query building, round trips and entity mapping; no HTTP), pooled over all rounds. DB time is the median `EXPLAIN ANALYZE` execution time of the SQL one call issues, summed over its statements, and blocks are the shared buffers those statements touched.

### discover: browse

| Variant | p50 | p95 | mean | DB time | Blocks | vs none (p50) | Bookings access |
|---|---:|---:|---:|---:|---:|---:|---|
| none | 11.94 | 17.23 | 12.12 | 4.19 | 87 | 1.00× | not read |
| migrations | 12.30 | 15.38 | 12.17 | 4.69 | 87 | 0.97× | not read |
| availability-check | 11.73 | 14.91 | 11.13 | 5.18 | 87 | 1.02× | not read |
| blocking-partial | 10.90 | 14.40 | 10.70 | 5.57 | 87 | 1.09× | not read |

### discover: free at slot

| Variant | p50 | p95 | mean | DB time | Blocks | vs none (p50) | Bookings access |
|---|---:|---:|---:|---:|---:|---:|---|
| none | 24.93 | 49.18 | 29.00 | 17.46 | 2479 | 1.00× | Seq Scan; Bitmap Heap Scan using EXCL_bookings_resource_period_blocking ×9 |
| migrations | 15.35 | 24.08 | 16.82 | 5.42 | 828 | 1.62× | Bitmap Heap Scan using IDX_bookings_analytics_date_status_resource; Index Scan using IDX_bookings_resource_date ×9 |
| availability-check | 14.73 | 18.74 | 15.01 | 4.60 | 238 | 1.69× | Bitmap Heap Scan using IDX_bookings_availability_check; Index Scan using IDX_bookings_resource_date ×9 |
| blocking-partial | 14.81 | 18.52 | 15.12 | 5.16 | 822 | 1.68× | Bitmap Heap Scan using IDX_bookings_analytics_date_status_resource; Index Only Scan using IDX_bookings_blocking_resource_date ×9 |

### discover: slot + filters

| Variant | p50 | p95 | mean | DB time | Blocks | vs none (p50) | Bookings access |
|---|---:|---:|---:|---:|---:|---:|---|
| none | 22.84 | 29.98 | 23.56 | 14.37 | 2363 | 1.00× | Seq Scan; Bitmap Heap Scan using EXCL_bookings_resource_period_blocking ×9 |
| migrations | 13.53 | 20.77 | 14.10 | 5.87 | 836 | 1.69× | Bitmap Heap Scan using IDX_bookings_analytics_date_status_resource; Index Scan using IDX_bookings_resource_date ×9 |
| availability-check | 11.69 | 15.23 | 12.05 | 2.72 | 246 | 1.95× | Bitmap Heap Scan using IDX_bookings_availability_check; Index Scan using IDX_bookings_resource_date ×9 |
| blocking-partial | 12.48 | 22.15 | 13.95 | 3.14 | 830 | 1.83× | Bitmap Heap Scan using IDX_bookings_analytics_date_status_resource; Index Only Scan using IDX_bookings_blocking_resource_date ×9 |

### discover: slot + text search

| Variant | p50 | p95 | mean | DB time | Blocks | vs none (p50) | Bookings access |
|---|---:|---:|---:|---:|---:|---:|---|
| none | 30.34 | 45.90 | 32.08 | 21.12 | 2473 | 1.00× | Seq Scan; Bitmap Heap Scan using EXCL_bookings_resource_period_blocking ×9 |
| migrations | 18.48 | 24.20 | 19.26 | 8.13 | 828 | 1.64× | Bitmap Heap Scan using IDX_bookings_analytics_date_status_resource; Index Scan using IDX_bookings_resource_date ×9 |
| availability-check | 17.04 | 20.20 | 17.58 | 7.73 | 238 | 1.78× | Bitmap Heap Scan using IDX_bookings_availability_check; Index Scan using IDX_bookings_resource_date ×9 |
| blocking-partial | 17.57 | 25.72 | 18.58 | 8.07 | 822 | 1.73× | Bitmap Heap Scan using IDX_bookings_analytics_date_status_resource; Index Only Scan using IDX_bookings_blocking_resource_date ×9 |

### discover: slot, deep page

| Variant | p50 | p95 | mean | DB time | Blocks | vs none (p50) | Bookings access |
|---|---:|---:|---:|---:|---:|---:|---|
| none | 25.65 | 34.45 | 27.32 | 15.99 | 2463 | 1.00× | Seq Scan; Bitmap Heap Scan using EXCL_bookings_resource_period_blocking ×9 |
| migrations | 13.65 | 18.96 | 14.43 | 5.18 | 827 | 1.88× | Bitmap Heap Scan using IDX_bookings_analytics_date_status_resource; Index Scan using IDX_bookings_resource_date ×9 |
| availability-check | 14.47 | 25.06 | 16.66 | 5.83 | 237 | 1.77× | Bitmap Heap Scan using IDX_bookings_availability_check; Index Scan using IDX_bookings_resource_date ×9 |
| blocking-partial | 14.62 | 25.98 | 16.33 | 5.38 | 823 | 1.75× | Bitmap Heap Scan using IDX_bookings_analytics_date_status_resource; Index Only Scan using IDX_bookings_blocking_resource_date ×9 |

### availability snapshot

| Variant | p50 | p95 | mean | DB time | Blocks | vs none (p50) | Bookings access |
|---|---:|---:|---:|---:|---:|---:|---|
| none | 6.89 | 8.81 | 6.72 | 0.49 | 46 | 1.00× | Bitmap Heap Scan using EXCL_bookings_resource_period_blocking |
| migrations | 7.00 | 8.12 | 7.05 | 0.45 | 11 | 0.98× | Index Scan using IDX_bookings_resource_date |
| availability-check | 7.35 | 9.19 | 7.60 | 0.49 | 11 | 0.94× | Index Scan using IDX_bookings_resource_date |
| blocking-partial | 6.82 | 9.01 | 6.41 | 0.25 | 11 | 1.01× | Index Scan using IDX_bookings_blocking_resource_date |

## Result consistency

Every scenario returned identical results under every index variant.
