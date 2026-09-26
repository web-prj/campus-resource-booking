import 'reflect-metadata';
import * as bcrypt from 'bcrypt';
import { ChildProcess, execSync, spawn } from 'child_process';
import { randomBytes } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { cpus, loadavg } from 'os';
import { dirname, join } from 'path';
import { performance } from 'perf_hooks';
import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { campusDateOf } from '../common/time/campus-clock';
import { DEFAULT_DB_PORT } from '../config/defaults';
import {
  BLOCKING_STATUSES,
  indexDefinition,
  INDEX_VARIANTS,
  MANAGED_INDEXES,
} from './availability-benchmark';
import {
  createRng,
  IndexComparison,
  LoadTestOptions,
  mergeMeasurements,
  parseLoadArgs,
  pickRead,
  PlannedRequest,
  renderLoadReport,
  Sample,
  StageMeasurement,
  StageResult,
  stressLimitReached,
  summarizeStage,
  uniqueSlot,
  WorkloadContext,
} from './load-test';
import {
  addDays,
  SEEDED_TABLES,
  seedSyntheticCatalog,
} from './synthetic-catalog';

/*
 * HTTP load and stress test.
 *
 *   npm run load:test -- [--levels 1,10,50,100]
 *     [--stress-levels 50,100,200,400,800,1600]
 *     [--duration 15] [--warmup 3] [--rounds 2] [--resources 1000]
 *     [--bookings 50000] [--students 1000] [--sessions 200] [--storm-slots 20]
 *     [--storm-concurrency 100] [--max-error-rate 0.01] [--max-p95 2000]
 *     [--database web_backend_loadtest] [--port 18330] [--seed 0.42]
 *     [--env .env.test] [--keep-database]
 *     [--out ../docs/benchmarks/load-test.md]
 *
 * Creates its own throwaway database (marked with a comment so the run never
 * drops a database it did not create), migrates and seeds it, starts the built
 * API (`dist/main.js`) against it with NODE_ENV=production, drives it over
 * HTTP, then stops the API and drops the database.
 */

const DATABASE_MARKER = 'campus-resource-booking load test (safe to drop)';
const LOAD_BUILDING_CODE = 'LOAD-TEST';
const EMAIL_PREFIX = 'load';
/** Searches and availability grids ask about the next week. */
const READ_DAYS = 7;
/** Write-phase bookings start after the seeded window, so slots are free. */
const WRITE_DAYS_AHEAD = 45;
const STORM_DAYS_AHEAD = 90;
const REQUEST_TIMEOUT_MS = 30_000;
const DEFAULT_RATE_LIMIT = 100;
const DEFAULT_RATE_WINDOW_SECONDS = 60;
const RATE_LIMIT_REQUESTS = 150;

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required (set it or pass --env)`);
  return value;
}

function connectionOptions(database: string) {
  return {
    type: 'postgres' as const,
    host: required('DB_HOST'),
    port: Number(process.env.DB_PORT ?? DEFAULT_DB_PORT),
    username: required('DB_USERNAME'),
    password: process.env.DB_PASSWORD,
    database,
    applicationName: 'load-test',
  };
}

/** Recreates the throwaway database, refusing one this tool did not create. */
async function recreateDatabase(name: string): Promise<void> {
  const admin = new DataSource(connectionOptions('postgres'));
  await admin.initialize();
  try {
    const [existing] = (await admin.query(
      `SELECT shobj_description(oid, 'pg_database') AS comment
       FROM pg_database WHERE datname = $1`,
      [name],
    )) as { comment: string | null }[];
    if (existing) {
      if (existing.comment !== DATABASE_MARKER) {
        throw new Error(
          `Database "${name}" exists and was not created by the load test; refusing to drop it.`,
        );
      }
      await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
    }
    await admin.query(`CREATE DATABASE "${name}"`);
    await admin.query(`COMMENT ON DATABASE "${name}" IS '${DATABASE_MARKER}'`);
  } finally {
    await admin.destroy();
  }
}

async function dropDatabase(name: string): Promise<void> {
  const admin = new DataSource(connectionOptions('postgres'));
  await admin.initialize();
  try {
    const [existing] = (await admin.query(
      `SELECT shobj_description(oid, 'pg_database') AS comment
       FROM pg_database WHERE datname = $1`,
      [name],
    )) as { comment: string | null }[];
    if (existing?.comment === DATABASE_MARKER) {
      await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
    }
  } finally {
    await admin.destroy();
  }
}

async function applyIndexes(
  dataSource: DataSource,
  indexes: string[],
): Promise<void> {
  for (const index of MANAGED_INDEXES) {
    await dataSource.query(`DROP INDEX IF EXISTS "${index.name}"`);
  }
  for (const name of indexes) await dataSource.query(indexDefinition(name));
  await dataSource.query('ANALYZE bookings');
}

const CLOCK_TICKS = (() => {
  try {
    return Number(execSync('getconf CLK_TCK').toString().trim()) || 100;
  } catch {
    return 100;
  }
})();

/** The API under test, run as a child process. */
class ApiServer {
  private child: ChildProcess | null = null;
  private readonly log: string[] = [];

  constructor(
    private readonly port: number,
    private readonly env: NodeJS.ProcessEnv,
  ) {}

  get baseUrl(): string {
    return `http://127.0.0.1:${this.port}/api`;
  }

  async start(): Promise<void> {
    const main = join(__dirname, '..', '..', 'dist', 'main.js');
    if (!existsSync(main)) {
      throw new Error(`${main} not found; run npm run build first.`);
    }
    const child = spawn(process.execPath, [main], {
      env: this.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    this.child = child;
    const keep = (chunk: Buffer) => {
      this.log.push(...chunk.toString().split('\n').filter(Boolean));
      this.log.splice(0, Math.max(0, this.log.length - 40));
    };
    child.stdout?.on('data', keep);
    child.stderr?.on('data', keep);

    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      if (child.exitCode !== null) break;
      try {
        const response = await fetch(`${this.baseUrl}/health`);
        if (response.ok) return;
      } catch {
        // Not listening yet.
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    await this.stop();
    throw new Error(`The API did not start:\n${this.log.join('\n')}`);
  }

  /** CPU seconds used so far and resident memory, read from /proc (Linux). */
  usage(): { cpuSeconds?: number; rssMb?: number } {
    const pid = this.child?.pid;
    if (!pid) return {};
    try {
      const stat = readFileSync(`/proc/${pid}/stat`, 'utf8');
      const fields = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
      const status = readFileSync(`/proc/${pid}/status`, 'utf8');
      const rss = /VmRSS:\s+(\d+) kB/.exec(status);
      return {
        cpuSeconds: (Number(fields[11]) + Number(fields[12])) / CLOCK_TICKS,
        rssMb: rss ? Number(rss[1]) / 1024 : undefined,
      };
    } catch {
      return {};
    }
  }

  async stop(): Promise<void> {
    const child = this.child;
    this.child = null;
    if (!child || child.exitCode !== null) return;
    const exited = new Promise((resolve) => child.once('exit', resolve));
    child.kill('SIGTERM');
    const timer = setTimeout(() => child.kill('SIGKILL'), 10_000);
    await exited;
    clearTimeout(timer);
  }
}

async function send(
  baseUrl: string,
  request: PlannedRequest,
  cookie?: string,
): Promise<Sample> {
  const headers: Record<string, string> = {};
  if (cookie) headers.cookie = cookie;
  if (request.body) headers['content-type'] = 'application/json';
  const started = performance.now();
  try {
    const response = await fetch(`${baseUrl}${request.path}`, {
      method: request.method,
      headers,
      body: request.body ? JSON.stringify(request.body) : undefined,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    await response.arrayBuffer();
    return {
      name: request.name,
      ms: performance.now() - started,
      status: response.status,
      ok: request.expect.includes(response.status),
    };
  } catch {
    return {
      name: request.name,
      ms: performance.now() - started,
      status: 0,
      ok: false,
    };
  }
}

/**
 * Closed loop: each virtual user sends its next request as soon as the last
 * one finishes, with no think time. Requests started during the warm-up are
 * not measured.
 */
async function runTimedStage(
  server: ApiServer,
  concurrency: number,
  seconds: number,
  warmupSeconds: number,
  next: (user: number) => PlannedRequest,
  cookieFor: (user: number) => string,
): Promise<StageMeasurement> {
  const measureFrom = performance.now() + warmupSeconds * 1000;
  const end = measureFrom + seconds * 1000;
  const samples: Sample[] = [];
  let startUsage = server.usage();
  const warmupTimer = setTimeout(() => {
    startUsage = server.usage();
  }, warmupSeconds * 1000);

  await Promise.all(
    Array.from({ length: concurrency }, async (_, user) => {
      while (performance.now() < end) {
        const measured = performance.now() >= measureFrom;
        const sample = await send(server.baseUrl, next(user), cookieFor(user));
        if (measured) samples.push(sample);
      }
    }),
  );
  clearTimeout(warmupTimer);
  const endUsage = server.usage();
  return {
    samples,
    elapsedMs: performance.now() - measureFrom,
    serverCpuSeconds:
      startUsage.cpuSeconds !== undefined && endUsage.cpuSeconds !== undefined
        ? endUsage.cpuSeconds - startUsage.cpuSeconds
        : undefined,
    serverRssMb: endUsage.rssMb,
  };
}

/** Sends a fixed list of requests, at most `concurrency` at a time. */
async function runBatch(
  server: ApiServer,
  requests: { request: PlannedRequest; cookie?: string }[],
  concurrency: number,
): Promise<StageMeasurement> {
  const started = performance.now();
  const startUsage = server.usage();
  const samples: Sample[] = new Array<Sample>(requests.length);
  let nextIndex = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, requests.length) }, async () => {
      while (nextIndex < requests.length) {
        const index = nextIndex;
        nextIndex += 1;
        const { request, cookie } = requests[index];
        samples[index] = await send(server.baseUrl, request, cookie);
      }
    }),
  );
  const endUsage = server.usage();
  return {
    samples,
    elapsedMs: performance.now() - started,
    serverCpuSeconds:
      startUsage.cpuSeconds !== undefined && endUsage.cpuSeconds !== undefined
        ? endUsage.cpuSeconds - startUsage.cpuSeconds
        : undefined,
    serverRssMb: endUsage.rssMb,
  };
}

async function logIn(
  baseUrl: string,
  email: string,
  password: string,
): Promise<{ sample: Sample; cookie?: string }> {
  const started = performance.now();
  try {
    const response = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    await response.arrayBuffer();
    const cookie = response.headers
      .getSetCookie()
      .map((header) => header.split(';')[0])
      .find((pair) => pair.includes('='));
    return {
      sample: {
        name: 'login',
        ms: performance.now() - started,
        status: response.status,
        ok: response.status === 200 && Boolean(cookie),
      },
      cookie,
    };
  } catch {
    return {
      sample: {
        name: 'login',
        ms: performance.now() - started,
        status: 0,
        ok: false,
      },
    };
  }
}

async function logInAll(
  server: ApiServer,
  emails: string[],
  password: string,
  concurrency: number,
): Promise<{ cookies: string[]; stage: StageResult }> {
  const started = performance.now();
  const cookies: string[] = [];
  const samples: Sample[] = [];
  let nextIndex = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, emails.length) }, async () => {
      while (nextIndex < emails.length) {
        const index = nextIndex;
        nextIndex += 1;
        const { sample, cookie } = await logIn(
          server.baseUrl,
          emails[index],
          password,
        );
        samples.push(sample);
        if (cookie) cookies[index] = cookie;
      }
    }),
  );
  const stage = summarizeStage('login', concurrency, {
    samples,
    elapsedMs: performance.now() - started,
  });
  if (stage.errors > 0) {
    throw new Error(`${stage.errors} of ${emails.length} logins failed.`);
  }
  return { cookies, stage };
}

function serverEnv(
  options: LoadTestOptions,
  limits: { general: number; auth: number },
): NodeJS.ProcessEnv {
  return {
    ...process.env,
    // The deployed configuration: production mode, secure cookies.
    NODE_ENV: 'production',
    PORT: String(options.port),
    API_PREFIX: 'api',
    DB_NAME: options.database,
    DB_SYNCHRONIZE: 'false',
    DB_LOGGING: 'false',
    AUTH_JWT_SECRET: randomBytes(48).toString('base64'),
    AUTH_COOKIE_SECURE: 'true',
    AUTH_TOKEN_EXPIRES_IN: '4h',
    THROTTLE_TTL: String(DEFAULT_RATE_WINDOW_SECONDS),
    THROTTLE_LIMIT: String(limits.general),
    AUTH_THROTTLE_LIMIT: String(limits.auth),
    BOOTSTRAP_ADMIN_EMAIL: '',
    BOOTSTRAP_ADMIN_PASSWORD: '',
    BOOTSTRAP_STAFF_EMAIL: '',
    BOOTSTRAP_STAFF_PASSWORD: '',
  };
}

function report(label: string, stage: StageResult): void {
  console.log(
    `  ${label}: ${stage.requests} req, ${stage.throughput.toFixed(0)} req/s, p50 ${stage.latency.p50.toFixed(1)} ms, p95 ${stage.latency.p95.toFixed(1)} ms, errors ${(stage.errorRate * 100).toFixed(2)}%`,
  );
}

async function main(): Promise<void> {
  const options = parseLoadArgs(process.argv.slice(2));
  loadEnv({ path: options.envFile, quiet: true });
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to run the load test with NODE_ENV=production.');
  }

  const today = campusDateOf(new Date());
  const password = randomBytes(18).toString('base64url');
  const loadAverage = loadavg()
    .map((value) => value.toFixed(2))
    .join(', ');

  console.log(`Creating ${options.database}...`);
  await recreateDatabase(options.database);

  const dataSource = new DataSource({
    ...connectionOptions(options.database),
    entities: [join(__dirname, '..', '**', '*.entity{.ts,.js}')],
    migrations: [join(__dirname, '..', 'database', 'migrations', '*{.ts,.js}')],
    synchronize: false,
  });
  await dataSource.initialize();

  let server: ApiServer | null = null;
  let markdown = '';
  try {
    await dataSource.runMigrations({ transaction: 'each' });

    console.log(`Seeding ${options.bookings} bookings...`);
    const seedStarted = Date.now();
    const runner = dataSource.createQueryRunner();
    let dataset: Record<string, string>;
    try {
      await runner.startTransaction();
      dataset = await seedSyntheticCatalog(
        runner,
        {
          ...options,
          buildingCode: LOAD_BUILDING_CODE,
          codePrefix: 'LOAD',
          emailPrefix: EMAIL_PREFIX,
          passwordHash: await bcrypt.hash(password, 10),
          pastDays: 60,
          futureDays: 30,
        },
        today,
      );
      await runner.commitTransaction();
      await runner.query(`VACUUM (ANALYZE) ${SEEDED_TABLES}`);
    } finally {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      await runner.release();
    }
    dataset['Seed time'] =
      `${((Date.now() - seedStarted) / 1000).toFixed(1)} s`;

    const [database] = (await dataSource.query(
      `SELECT current_setting('server_version') AS version,
              current_setting('shared_buffers') AS shared_buffers,
              current_setting('max_connections') AS max_connections`,
    )) as Record<string, string>[];
    const resourceIds = (
      (await dataSource.query(
        `SELECT id FROM resources
         WHERE starts_with(code, 'LOAD-') AND status = 'active' ORDER BY code`,
      )) as { id: string }[]
    ).map((row) => row.id);
    // Open 07:00-22:00 every day, so any date and hour is bookable.
    const bookableIds = (
      (await dataSource.query(
        `SELECT id FROM resources
         WHERE starts_with(code, 'LOAD-') AND status = 'active'
           AND opens_at = '07:00' AND closes_at = '22:00'
           AND cardinality(operating_days) = 7
         ORDER BY code`,
      )) as { id: string }[]
    ).map((row) => row.id);
    const context: WorkloadContext = {
      resourceIds,
      dates: Array.from({ length: READ_DAYS }, (_, i) => addDays(today, i + 1)),
    };

    server = new ApiServer(
      options.port,
      serverEnv(options, { general: 1_000_000_000, auth: 1_000_000_000 }),
    );
    await server.start();

    const emails = Array.from(
      { length: Math.min(options.sessions, options.students) },
      (_, i) => `${EMAIL_PREFIX}.student.${i + 1}@usth.edu.vn`,
    );
    console.log(`Logging in ${emails.length} students...`);
    const { cookies, stage: login } = await logInAll(
      server,
      emails,
      password,
      50,
    );
    report('login', login);
    const cookieFor = (user: number) => cookies[user % cookies.length];

    const readStage = async (
      concurrency: number,
      seconds: number,
      seed: number,
    ) => {
      const rngs = Array.from({ length: concurrency }, (_, user) =>
        createRng(seed * 7919 + user),
      );
      return runTimedStage(
        server!,
        concurrency,
        seconds,
        options.warmup,
        (user) => pickRead(rngs[user], context),
        cookieFor,
      );
    };

    // 1. Before/after the booking indexes. The variant order alternates
    // between rounds and runs are pooled, so warm-up and drift even out.
    const variants = INDEX_VARIANTS.filter(
      (variant) => variant.key === 'none' || variant.key === 'migrations',
    );
    const runs = new Map<string, StageMeasurement[]>();
    for (let round = 1; round <= options.rounds; round += 1) {
      const order = round % 2 === 1 ? variants : [...variants].reverse();
      for (const variant of order) {
        await applyIndexes(dataSource, variant.indexes);
        for (const level of options.levels) {
          console.log(
            `Round ${round}/${options.rounds}: ${variant.key}, ${level} users`,
          );
          const measurement = await readStage(level, options.duration, level);
          const key = `${variant.key}:${level}`;
          runs.set(key, [...(runs.get(key) ?? []), measurement]);
          report(key, summarizeStage(key, level, measurement));
        }
      }
    }
    const indexComparison: IndexComparison[] = variants.map((variant) => ({
      key: variant.key,
      label: variant.key,
      stages: options.levels.map((level) =>
        summarizeStage(
          variant.key,
          level,
          mergeMeasurements(runs.get(`${variant.key}:${level}`) ?? []),
        ),
      ),
    }));
    // Everything after this runs with the indexes the migrations create.
    await applyIndexes(
      dataSource,
      variants.find((variant) => variant.key === 'migrations')!.indexes,
    );

    // 2. Response cache: the same route with and without cache hits.
    const cacheUsers = 50;
    let bust = 0;
    const cachedRun = await runTimedStage(
      server,
      cacheUsers,
      options.duration,
      options.warmup,
      () => ({
        name: 'buildings',
        method: 'GET',
        path: '/resources/buildings',
        expect: [200],
      }),
      cookieFor,
    );
    const uncachedRun = await runTimedStage(
      server,
      cacheUsers,
      options.duration,
      options.warmup,
      () => ({
        name: 'buildings',
        method: 'GET',
        path: `/resources/buildings?nocache=${(bust += 1)}`,
        expect: [200],
      }),
      cookieFor,
    );
    const cache = {
      cached: summarizeStage('cached', cacheUsers, cachedRun),
      uncached: summarizeStage('cache miss', cacheUsers, uncachedRun),
    };
    report('cache hit', cache.cached);
    report('cache miss', cache.uncached);

    // 3. Booking writes, each to a distinct free slot.
    const writeUsers = 50;
    let slot = 0;
    const writesRun = await runTimedStage(
      server,
      writeUsers,
      options.duration,
      options.warmup,
      () => ({
        name: 'create booking',
        method: 'POST',
        path: '/bookings',
        body: uniqueSlot(
          (slot += 1),
          bookableIds,
          addDays(today, WRITE_DAYS_AHEAD),
        ),
        expect: [201],
      }),
      cookieFor,
    );
    const writes = summarizeStage('writes', writeUsers, writesRun);
    report('writes', writes);

    // 4. Double-booking storm: every request of a burst targets one slot.
    const stormDate = addDays(today, STORM_DAYS_AHEAD);
    const stormIds = bookableIds.slice(0, options.stormSlots);
    const stormRuns: StageMeasurement[] = [];
    const createdPerSlot: number[] = [];
    for (const resourceId of stormIds) {
      const burst = Array.from(
        { length: options.stormConcurrency },
        (_, i) => ({
          request: {
            name: 'contended booking',
            method: 'POST' as const,
            path: '/bookings',
            body: {
              resourceId,
              date: stormDate,
              startTime: '10:00',
              endTime: '11:00',
            },
            expect: [201, 409],
          },
          cookie: cookieFor(i),
        }),
      );
      const run = await runBatch(server, burst, options.stormConcurrency);
      stormRuns.push(run);
      createdPerSlot.push(
        run.samples.filter((sample) => sample.status === 201).length,
      );
    }
    const rows = (await dataSource.query(
      `SELECT r.id, count(b.id)::int AS count
       FROM unnest($1::uuid[]) AS r(id)
       LEFT JOIN bookings b ON b.resource_id = r.id AND b.booking_date = $2
         AND b.start_time = '10:00' AND b.status::text = ANY ($3)
       GROUP BY r.id`,
      [stormIds, stormDate, BLOCKING_STATUSES],
    )) as { id: string; count: number }[];
    const storm = {
      slots: stormIds.length,
      concurrency: options.stormConcurrency,
      stage: summarizeStage(
        'storm',
        options.stormConcurrency,
        mergeMeasurements(stormRuns),
      ),
      createdPerSlot,
      rowsPerSlot: stormIds.map(
        (id) => rows.find((row) => row.id === id)?.count ?? 0,
      ),
    };
    report('storm', storm.stage);

    // 5. Stress ramp.
    const stressStages: StageResult[] = [];
    let stopReason = `no limit reached up to ${options.stressLevels[options.stressLevels.length - 1]} virtual users`;
    for (const level of options.stressLevels) {
      console.log(`Stress: ${level} users`);
      const stage = summarizeStage(
        `stress ${level}`,
        level,
        await readStage(level, options.duration, level + 1),
      );
      stressStages.push(stage);
      report(`stress ${level}`, stage);
      const reason = stressLimitReached(stage, options);
      if (reason) {
        stopReason = `stopped: ${reason}`;
        break;
      }
    }

    // 6. Rate limiter, with the default limits.
    await server.stop();
    server = new ApiServer(
      options.port,
      serverEnv(options, { general: DEFAULT_RATE_LIMIT, auth: 10 }),
    );
    await server.start();
    const { cookie } = await logIn(server.baseUrl, emails[0], password);
    const limitedRun = await runBatch(
      server,
      Array.from({ length: RATE_LIMIT_REQUESTS }, () => ({
        request: {
          name: 'rate limited',
          method: 'GET' as const,
          path: '/resources',
          expect: [200, 429],
        },
        cookie,
      })),
      25,
    );
    const rateLimit = {
      limit: DEFAULT_RATE_LIMIT,
      windowSeconds: DEFAULT_RATE_WINDOW_SECONDS,
      stage: summarizeStage('rate limit', 25, limitedRun),
    };
    report('rate limit', rateLimit.stage);

    markdown = renderLoadReport({
      generatedAt: new Date().toISOString(),
      environment: {
        PostgreSQL: `${database.version} (shared_buffers ${database.shared_buffers}, max_connections ${database.max_connections})`,
        'Node.js': process.version,
        CPU: `${cpus().length} × ${cpus()[0]?.model.trim() ?? 'unknown'}`,
        'Load average at start': loadAverage,
        API: 'One `node dist/main.js` process, NODE_ENV=production, default TypeORM pool (10 connections)',
        Client:
          'This script on the same host (Node.js fetch, keep-alive), so client and API share the CPUs',
      },
      dataset,
      method: [
        `Closed loop: each virtual user sends its next request as soon as the previous one finishes, with no think time, so these are maximum-throughput figures. Virtual users share ${cookies.length} logged-in student sessions.`,
        `Each stage runs ${options.warmup} s of unmeasured warm-up, then ${options.duration} s measured. The index comparison runs ${options.rounds} round(s) with alternating variant order and pools them.`,
        'An error is a timeout, a failed connection or an unexpected status (the storm expects 201 or 409; the rate-limit check expects 200 or 429).',
        'Rate limiting is raised for every stage except the rate-limit check: all virtual users share one client IP, which the default limit of 100 requests per minute would block almost immediately.',
        '"API CPU" is the API process\'s CPU time over the stage; 100% is one full core. Node.js runs the application on one thread, so it tops out near 100% plus some garbage-collector and I/O threads.',
      ],
      login,
      indexComparison,
      cache,
      writes,
      storm,
      stress: { stages: stressStages, stopReason },
      rateLimit,
    });
  } finally {
    await server?.stop();
    await dataSource.destroy();
    if (!options.keepDatabase) {
      await dropDatabase(options.database).catch((error: unknown) =>
        console.warn(
          `Could not drop ${options.database}: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    }
  }

  console.log(
    options.keepDatabase
      ? `\nKept ${options.database}.`
      : `\nDropped ${options.database}.`,
  );
  if (options.out) {
    mkdirSync(dirname(options.out), { recursive: true });
    writeFileSync(options.out, markdown);
    console.log(`Report written to ${options.out}`);
  } else {
    console.log(markdown);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
