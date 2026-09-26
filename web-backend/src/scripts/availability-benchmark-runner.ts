import 'reflect-metadata';
import { createHash } from 'crypto';
import { mkdirSync, writeFileSync } from 'fs';
import { cpus, loadavg } from 'os';
import { dirname, join } from 'path';
import { config as loadEnv } from 'dotenv';
import { DataSource, Logger, QueryRunner } from 'typeorm';
import { campusDateOf } from '../common/time/campus-clock';
import { DEFAULT_DB_PORT } from '../config/defaults';
import { AvailabilityEventsService } from '../events/availability-events.service';
import { Booking } from '../bookings/entities/booking.entity';
import {
  DiscoverResourcesQueryDto,
  ResourceSort,
} from '../resources/dto/discover-resources-query.dto';
import { Building } from '../resources/entities/building.entity';
import { ResourceClosure } from '../resources/entities/resource-closure.entity';
import { Resource } from '../resources/entities/resource.entity';
import { ResourceType } from '../resources/enums/resource-type.enum';
import { ResourcesService } from '../resources/resources.service';
import {
  BenchmarkOptions,
  BLOCKING_STATUSES,
  combinePlanRuns,
  ExplainOutput,
  INDEX_VARIANTS,
  MANAGED_INDEXES,
  PlanSummary,
  SCENARIO_DAYS_AHEAD,
  ScenarioResult,
  indexDefinition,
  parseArgs,
  renderReport,
  summarizePlans,
  summarizeTimings,
} from './availability-benchmark';

/*
 * Availability-query benchmark.
 *
 *   npm run bench:availability -- [--resources 1000] [--bookings 50000]
 *     [--past-days 60] [--future-days 30] [--iterations 40] [--warmup 5]
 *     [--rounds 3] [--explain-runs 5] [--seed 0.42] [--env .env.test]
 *     [--out ../docs/benchmarks/availability-query-benchmark.md]
 *
 * Everything runs in one transaction that is always rolled back: synthetic
 * rows, index changes and statistics disappear when it ends, and the tables
 * are vacuumed before and after so dead rows do not skew or linger. While it runs,
 * the index DDL holds an exclusive lock on `bookings`, so it only targets a
 * `*_test` database unless `--allow-any-database` is passed.
 */

const BENCH_BUILDING_CODE = 'BENCH-AVAIL';
const STUDENT_COUNT = 200;
const SEEDED_TABLES =
  'buildings, users, resources, resource_closures, bookings';

interface CapturedQuery {
  query: string;
  parameters?: unknown[];
}

/** Records the SQL TypeORM sends while capture is on. */
class QueryCapture implements Logger {
  private recording: CapturedQuery[] | null = null;

  start(): void {
    this.recording = [];
  }

  stop(): CapturedQuery[] {
    const queries = this.recording ?? [];
    this.recording = null;
    return queries;
  }

  logQuery(query: string, parameters?: unknown[]): void {
    this.recording?.push({ query, parameters });
  }

  logQueryError(): void {}
  logQuerySlow(): void {}
  logSchemaBuild(): void {}
  logMigration(): void {}
  log(): void {}
}

interface Scenario {
  name: string;
  description: string;
  run: (service: ResourcesService) => Promise<unknown>;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required (set it or pass --env)`);
  return value;
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function discoverQuery(
  values: Partial<DiscoverResourcesQueryDto>,
): DiscoverResourcesQueryDto {
  return Object.assign(new DiscoverResourcesQueryDto(), values);
}

function buildScenarios(date: string, busyResourceId: string): Scenario[] {
  const slot = { date, startTime: '09:00', endTime: '10:00' };
  const discover =
    (values: Partial<DiscoverResourcesQueryDto>) =>
    async (service: ResourcesService) => {
      const [items, total] = await service.discover(discoverQuery(values));
      return { total, ids: items.map((item) => item.id) };
    };

  return [
    {
      name: 'discover: browse',
      description:
        'Catalog page 1 with no time slot (control; does not read bookings).',
      run: discover({}),
    },
    {
      name: 'discover: free at slot',
      description: `Resources free on ${date} 09:00-10:00, page 1 (the search page's main query).`,
      run: discover(slot),
    },
    {
      name: 'discover: slot + filters',
      description:
        'Same slot, laboratories with capacity >= 30, sorted by capacity.',
      run: discover({
        ...slot,
        type: ResourceType.LABORATORY,
        minCapacity: 30,
        sort: ResourceSort.CAPACITY_DESC,
      }),
    },
    {
      name: 'discover: slot + text search',
      description: 'Same slot with the free-text search "lab".',
      run: discover({ ...slot, q: 'lab' }),
    },
    {
      name: 'discover: slot, deep page',
      description: 'Same slot, page 50 (late pagination).',
      run: discover({ ...slot, page: 50 }),
    },
    {
      name: 'availability snapshot',
      description: `Slot grid for the busiest synthetic resource on ${date} (resource detail page).`,
      run: async (service) => {
        const snapshot = await service.findAvailabilitySnapshot(
          busyResourceId,
          date,
        );
        return snapshot?.bookings.map((booking) => booking.id) ?? null;
      },
    },
  ];
}

async function seed(
  runner: QueryRunner,
  options: BenchmarkOptions,
  today: string,
): Promise<Record<string, string>> {
  await runner.query('SELECT setseed($1)', [options.seed]);

  const [building] = (await runner.query(
    `INSERT INTO buildings (code, name, address)
     VALUES ($1, 'Availability benchmark building', 'Synthetic, rolled back')
     RETURNING id`,
    [BENCH_BUILDING_CODE],
  )) as { id: string }[];

  await runner.query(
    `INSERT INTO users (email, password_hash, full_name, role)
     SELECT 'bench.student.' || g || '@usth.edu.vn', repeat('x', 60),
            'Bench Student ' || g, 'student'
     FROM generate_series(1, $1) AS g`,
    [STUDENT_COUNT],
  );
  const [staff] = (await runner.query(
    `INSERT INTO users (email, password_hash, full_name, role)
     VALUES ('bench.staff@usth.edu.vn', repeat('x', 60), 'Bench Staff', 'staff')
     RETURNING id`,
  )) as { id: string }[];

  // 70% open 07:00-22:00 every day, 30% open 08:00-18:00 Monday-Saturday;
  // one in twenty is under maintenance and one in thirty-three inactive.
  await runner.query(
    `INSERT INTO resources (
       code, name, type, status, capacity, location, amenities,
       requires_approval, building_id, operating_days, opens_at, closes_at)
     SELECT 'BENCH-' || lpad(g::text, 5, '0'),
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
    [building.id, options.resources],
  );

  // Distinct one-hour slots inside each resource's hours, so no two bookings
  // overlap whatever their status. Status mix: 45% confirmed, 25% pending,
  // 20% cancelled, 10% rejected. The status roll is drawn after the random
  // pick; drawn in the same row as the ORDER BY random() it is correlated
  // with it and skews the mix.
  await runner.query(
    `WITH students AS (
       SELECT array_agg(id) AS ids FROM users WHERE email LIKE 'bench.student.%'
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
    Bookings: `${stats.bookings} (${stats.blocking} holding a slot)`,
    'Status mix': stats.status_mix,
    'Booking window': `${addDays(today, -options.pastDays)} to ${addDays(today, options.futureDays)}`,
    Closures: stats.closures,
    'bookings table + indexes': stats.bookings_size,
    'Random seed': String(options.seed),
  };
}

/**
 * Rolled-back rows stay behind as dead tuples until vacuumed. Vacuuming before
 * the run keeps earlier runs from inflating scans; vacuuming after it leaves
 * no bloat behind. Must run outside a transaction.
 */
async function vacuum(runner: QueryRunner): Promise<void> {
  await runner.query(`VACUUM (ANALYZE) ${SEEDED_TABLES}`);
}

async function applyVariant(
  runner: QueryRunner,
  indexes: string[],
): Promise<void> {
  for (const index of MANAGED_INDEXES) {
    await runner.query(`DROP INDEX IF EXISTS "${index.name}"`);
  }
  for (const name of indexes) await runner.query(indexDefinition(name));
  await runner.query('ANALYZE bookings');
}

async function explain(
  runner: QueryRunner,
  queries: CapturedQuery[],
): Promise<ExplainOutput[]> {
  const plans: ExplainOutput[] = [];
  for (const { query, parameters } of queries) {
    if (!/^\s*SELECT\b/i.test(query)) continue;
    const rows = (await runner.query(
      `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`,
      parameters,
    )) as { 'QUERY PLAN': ExplainOutput[] }[];
    plans.push(rows[0]['QUERY PLAN'][0]);
  }
  return plans;
}

interface Measurement {
  samples: number[];
  plans: PlanSummary[];
  fingerprint: string;
}

/** Times one scenario under the current indexes and explains its SQL. */
async function measure(
  runner: QueryRunner,
  capture: QueryCapture,
  service: ResourcesService,
  scenario: Scenario,
  options: BenchmarkOptions,
): Promise<Measurement> {
  for (let i = 0; i < options.warmup; i += 1) await scenario.run(service);

  const samples: number[] = [];
  for (let i = 0; i < options.iterations; i += 1) {
    const started = process.hrtime.bigint();
    await scenario.run(service);
    samples.push(Number(process.hrtime.bigint() - started) / 1e6);
  }

  capture.start();
  const result = await scenario.run(service);
  const queries = capture.stop();
  const plans: PlanSummary[] = [];
  for (let i = 0; i < options.explainRuns; i += 1) {
    plans.push(summarizePlans(await explain(runner, queries)));
  }

  return {
    samples,
    plans,
    fingerprint: createHash('sha1')
      .update(JSON.stringify(result))
      .digest('hex')
      .slice(0, 12),
  };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  loadEnv({ path: options.envFile, quiet: true });

  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to run the benchmark with NODE_ENV=production.');
  }
  const database = required('DB_NAME');
  if (!database.endsWith('_test') && !options.allowAnyDatabase) {
    throw new Error(
      `Refusing to benchmark "${database}": its bookings table would be locked for the whole run. Use a *_test database (e.g. --env .env.test) or pass --allow-any-database.`,
    );
  }

  const capture = new QueryCapture();
  const dataSource = new DataSource({
    type: 'postgres',
    host: required('DB_HOST'),
    port: Number(process.env.DB_PORT ?? DEFAULT_DB_PORT),
    username: required('DB_USERNAME'),
    password: process.env.DB_PASSWORD,
    database,
    entities: [join(__dirname, '..', '**', '*.entity{.ts,.js}')],
    synchronize: false,
    logging: ['query'],
    logger: capture,
    applicationName: 'availability-benchmark',
  });
  await dataSource.initialize();

  const runner = dataSource.createQueryRunner();
  const today = campusDateOf(new Date());
  const date = addDays(today, SCENARIO_DAYS_AHEAD);
  const results: ScenarioResult[] = [];
  let report = '';

  try {
    await vacuum(runner);
    await runner.startTransaction();
    await runner.query("SET LOCAL lock_timeout = '5s'");
    await runner.query("SET LOCAL statement_timeout = '5min'");

    const [existing] = (await runner.query(
      'SELECT count(*)::int AS count FROM buildings WHERE code = $1',
      [BENCH_BUILDING_CODE],
    )) as { count: number }[];
    if (existing.count > 0) {
      throw new Error(`Building ${BENCH_BUILDING_CODE} already exists.`);
    }

    const [server] = (await runner.query(
      `SELECT current_setting('server_version') AS version,
              current_setting('shared_buffers') AS shared_buffers,
              current_setting('work_mem') AS work_mem`,
    )) as Record<string, string>[];
    const startingIndexes = (
      (await runner.query(
        `SELECT indexname FROM pg_indexes
         WHERE tablename = 'bookings' AND indexname = ANY ($1)
         ORDER BY indexname`,
        [MANAGED_INDEXES.map((index) => index.name)],
      )) as { indexname: string }[]
    ).map((row) => row.indexname);

    console.log(`Seeding ${options.bookings} bookings in ${database}...`);
    const seedStarted = Date.now();
    const dataset = await seed(runner, options, today);
    dataset['Seed time'] =
      `${((Date.now() - seedStarted) / 1000).toFixed(1)} s`;

    const [busy] = (await runner.query(
      `SELECT b.resource_id
       FROM bookings b JOIN resources r ON r.id = b.resource_id
       WHERE r.building_id = (SELECT id FROM buildings WHERE code = $1)
         AND b.booking_date = $2 AND b.status::text = ANY ($3)
       GROUP BY b.resource_id
       ORDER BY count(*) DESC, b.resource_id
       LIMIT 1`,
      [BENCH_BUILDING_CODE, date, BLOCKING_STATUSES],
    )) as { resource_id: string }[];
    if (!busy) throw new Error(`No synthetic bookings on ${date}.`);

    const manager = runner.manager;
    const service = new ResourcesService(
      manager.getRepository(Resource),
      manager.getRepository(Building),
      manager.getRepository(ResourceClosure),
      manager.getRepository(Booking),
      () => new Date(),
      // Read paths never publish events.
      {} as AvailabilityEventsService,
    );
    const scenarios = buildScenarios(date, busy.resource_id);

    // Variants alternate order between rounds so cache warm-up and drift do
    // not favour whichever variant runs first; samples are pooled.
    const measurements = new Map<string, Measurement[]>();
    for (let round = 1; round <= options.rounds; round += 1) {
      const variants =
        round % 2 === 1 ? INDEX_VARIANTS : [...INDEX_VARIANTS].reverse();
      for (const variant of variants) {
        console.log(`Round ${round}/${options.rounds}: ${variant.key}`);
        await runner.query('SAVEPOINT bench_variant');
        await applyVariant(runner, variant.indexes);
        for (const scenario of scenarios) {
          const key = `${variant.key}\u0000${scenario.name}`;
          const measurement = await measure(
            runner,
            capture,
            service,
            scenario,
            options,
          );
          measurements.set(key, [
            ...(measurements.get(key) ?? []),
            measurement,
          ]);
        }
        await runner.query('ROLLBACK TO SAVEPOINT bench_variant');
      }
    }

    const fingerprints = new Map<string, Set<string>>();
    for (const variant of INDEX_VARIANTS) {
      for (const scenario of scenarios) {
        const runs =
          measurements.get(`${variant.key}\u0000${scenario.name}`) ?? [];
        const result: ScenarioResult = {
          scenario: scenario.name,
          variant: variant.key,
          timings: summarizeTimings(runs.flatMap((run) => run.samples)),
          plan: combinePlanRuns(runs.flatMap((run) => run.plans)),
          fingerprint: runs[0]?.fingerprint ?? '',
        };
        results.push(result);
        const seen = fingerprints.get(scenario.name) ?? new Set<string>();
        for (const run of runs) seen.add(run.fingerprint);
        fingerprints.set(scenario.name, seen);
        console.log(
          `  ${variant.key} / ${scenario.name}: p50 ${result.timings.p50.toFixed(2)} ms, DB ${result.plan.executionMs.toFixed(2)} ms`,
        );
      }
    }

    const mismatches = scenarios
      .filter((scenario) => (fingerprints.get(scenario.name)?.size ?? 0) > 1)
      .map((scenario) => scenario.name);

    report = renderReport({
      generatedAt: new Date().toISOString(),
      environment: {
        PostgreSQL: server.version,
        'shared_buffers / work_mem': `${server.shared_buffers} / ${server.work_mem}`,
        'Node.js': process.version,
        CPU: `${cpus().length} × ${cpus()[0]?.model.trim() ?? 'unknown'}`,
        'Load average at start': loadavg()
          .map((value) => value.toFixed(2))
          .join(', '),
        Method: `${options.rounds} rounds (variant order alternates); per round, ${options.warmup} warm-up + ${options.iterations} timed calls and ${options.explainRuns} EXPLAIN ANALYZE runs per scenario and variant`,
        'Managed indexes present before the run': startingIndexes.length
          ? startingIndexes.map((name) => `\`${name}\``).join(', ')
          : 'none',
      },
      dataset,
      scenarios,
      variants: INDEX_VARIANTS,
      results,
      mismatches,
    });
  } finally {
    // Always discard the synthetic data and index changes.
    if (runner.isTransactionActive) await runner.rollbackTransaction();
    await vacuum(runner).catch((error: unknown) =>
      console.warn(
        `Post-run VACUUM failed; autovacuum will clean up: ${error instanceof Error ? error.message : String(error)}`,
      ),
    );
    await runner.release();
    await dataSource.destroy();
  }

  console.log('\nRolled back; the database is unchanged.\n');
  if (options.out) {
    mkdirSync(dirname(options.out), { recursive: true });
    writeFileSync(options.out, report);
    console.log(`Report written to ${options.out}`);
  } else {
    console.log(report);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
