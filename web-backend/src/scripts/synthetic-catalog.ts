import { QueryRunner } from 'typeorm';
import { BLOCKING_STATUSES } from './availability-benchmark';

/**
 * Synthetic campus data shared by the availability benchmark and the load
 * test: one building, a large resource catalog, students, and a mix of past
 * and future bookings and closures.
 */
export interface SyntheticCatalogOptions {
  /** Code of the building that owns every synthetic resource. */
  buildingCode: string;
  /** Prefix of the synthetic resource codes, e.g. `BENCH` gives `BENCH-00001`. */
  codePrefix: string;
  /** Email prefix: `bench` gives `bench.student.1@usth.edu.vn`, `bench.staff@…`. */
  emailPrefix: string;
  /** Stored as every synthetic user's password hash. */
  passwordHash: string;
  resources: number;
  bookings: number;
  students: number;
  pastDays: number;
  futureDays: number;
  /** Passed to `setseed`, so the data is reproducible. */
  seed: number;
}

export const SEEDED_TABLES =
  'buildings, users, resources, resource_closures, bookings';

export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/** Inserts the synthetic data and returns a description of it for reports. */
export async function seedSyntheticCatalog(
  runner: QueryRunner,
  options: SyntheticCatalogOptions,
  today: string,
): Promise<Record<string, string>> {
  await runner.query('SELECT setseed($1)', [options.seed]);

  const [building] = (await runner.query(
    `INSERT INTO buildings (code, name, address)
     VALUES ($1, 'Synthetic benchmark building', 'Synthetic data')
     RETURNING id`,
    [options.buildingCode],
  )) as { id: string }[];

  await runner.query(
    `INSERT INTO users (email, password_hash, full_name, role)
     SELECT $1 || '.student.' || g || '@usth.edu.vn', $2,
            'Synthetic Student ' || g, 'student'
     FROM generate_series(1, $3) AS g`,
    [options.emailPrefix, options.passwordHash, options.students],
  );
  const [staff] = (await runner.query(
    `INSERT INTO users (email, password_hash, full_name, role)
     VALUES ($1 || '.staff@usth.edu.vn', $2, 'Synthetic Staff', 'staff')
     RETURNING id`,
    [options.emailPrefix, options.passwordHash],
  )) as { id: string }[];

  // 70% open 07:00-22:00 every day, 30% open 08:00-18:00 Monday-Saturday;
  // one in twenty is under maintenance and one in thirty-three inactive.
  await runner.query(
    `INSERT INTO resources (
       code, name, type, status, capacity, location, amenities,
       requires_approval, building_id, operating_days, opens_at, closes_at)
     SELECT $3 || '-' || lpad(g::text, 5, '0'),
            (ARRAY['Room', 'Lab', 'Kit'])[g % 3 + 1] || ' ' || lpad(g::text, 5, '0'),
            (ARRAY['room', 'laboratory', 'equipment'])[g % 3 + 1]::resources_type_enum,
            (CASE WHEN g % 20 = 0 THEN 'maintenance'
                  WHEN g % 33 = 0 THEN 'inactive'
                  ELSE 'active' END)::resources_status_enum,
            (ARRAY[1, 4, 12, 24, 30, 40, 60, 80, 120, 200])[g % 10 + 1],
            'Floor ' || (g % 8 + 1),
            (CASE g % 4 WHEN 0 THEN ARRAY['projector', 'whiteboard']
                        WHEN 1 THEN ARRAY['computers']
                        WHEN 2 THEN ARRAY['fume_hood']
                        ELSE ARRAY[]::text[] END),
            g % 3 = 1,
            $1,
            (CASE WHEN g % 10 < 7 THEN '{0,1,2,3,4,5,6}' ELSE '{1,2,3,4,5,6}' END)::smallint[],
            (CASE WHEN g % 10 < 7 THEN '07:00' ELSE '08:00' END)::time,
            (CASE WHEN g % 10 < 7 THEN '22:00' ELSE '18:00' END)::time
     FROM generate_series(1, $2) AS g`,
    [building.id, options.resources, options.codePrefix],
  );

  // Distinct one-hour slots inside each resource's hours, so no two bookings
  // overlap whatever their status. Status mix: 45% confirmed, 25% pending,
  // 20% cancelled, 10% rejected. The status roll is drawn after the random
  // pick; drawn in the same row as the ORDER BY random() it is correlated
  // with it and skews the mix.
  await runner.query(
    `WITH students AS (
       SELECT array_agg(id) AS ids FROM users
       WHERE starts_with(email, $6 || '.student.')
     ), picked AS (
       SELECT r.id AS resource_id, d::date AS day, h
       FROM resources r
       CROSS JOIN generate_series($1::date, $2::date, interval '1 day') AS d
       CROSS JOIN LATERAL generate_series(
         extract(hour FROM r.opens_at)::int,
         extract(hour FROM r.closes_at)::int - 1) AS h
       WHERE r.building_id = $3
         AND extract(dow FROM d)::smallint = ANY (r.operating_days)
       ORDER BY random()
       LIMIT $4
     ), slots AS (
       SELECT picked.*, random() AS roll FROM picked
     )
     INSERT INTO bookings (
       resource_id, requester_id, booking_date, start_time, end_time, status,
       cancelled_at, reviewed_at, reviewed_by_id, rejection_reason)
     SELECT s.resource_id,
            st.ids[1 + floor(random() * cardinality(st.ids))::int],
            s.day, make_time(s.h, 0, 0), make_time(s.h + 1, 0, 0),
            v.status::bookings_status_enum,
            CASE WHEN v.status = 'cancelled' THEN now() END,
            CASE WHEN v.status = 'rejected' THEN now() END,
            CASE WHEN v.status = 'rejected' THEN $5::uuid END,
            CASE WHEN v.status = 'rejected' THEN 'Synthetic benchmark rejection' END
     FROM slots s
     CROSS JOIN students st
     CROSS JOIN LATERAL (
       SELECT CASE WHEN s.roll < 0.45 THEN 'confirmed'
                   WHEN s.roll < 0.70 THEN 'pending'
                   WHEN s.roll < 0.90 THEN 'cancelled'
                   ELSE 'rejected' END AS status
     ) AS v`,
    [
      addDays(today, -options.pastDays),
      addDays(today, options.futureDays),
      building.id,
      options.bookings,
      staff.id,
      options.emailPrefix,
    ],
  );

  await runner.query(
    `INSERT INTO resource_closures (resource_id, date, reason)
     SELECT r.id, d::date, 'Synthetic benchmark closure'
     FROM resources r
     CROSS JOIN generate_series($1::date, $2::date, interval '1 day') AS d
     WHERE r.building_id = $3 AND random() < 0.02`,
    [addDays(today, 1), addDays(today, options.futureDays), building.id],
  );

  await runner.query(`ANALYZE ${SEEDED_TABLES}`);

  const [stats] = (await runner.query(
    `SELECT
       (SELECT count(*) FROM resources) AS resources,
       (SELECT count(*) FROM bookings) AS bookings,
       (SELECT count(*) FROM bookings WHERE status::text = ANY ($1)) AS blocking,
       (SELECT count(*) FROM resource_closures) AS closures,
       (SELECT string_agg(status || ' ' || n, ', ' ORDER BY n DESC)
        FROM (SELECT status::text AS status, count(*) AS n
              FROM bookings GROUP BY 1) AS mix) AS status_mix,
       pg_size_pretty(pg_total_relation_size('bookings')) AS bookings_size`,
    [BLOCKING_STATUSES],
  )) as Record<string, string>[];
  return {
    Resources: `${stats.resources} (${options.resources} synthetic)`,
    Students: String(options.students),
    Bookings: `${stats.bookings} (${stats.blocking} holding a slot)`,
    'Status mix': stats.status_mix,
    'Booking window': `${addDays(today, -options.pastDays)} to ${addDays(today, options.futureDays)}`,
    Closures: stats.closures,
    'bookings table + indexes': stats.bookings_size,
    'Random seed': String(options.seed),
  };
}
