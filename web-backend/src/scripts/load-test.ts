import { percentile } from './availability-benchmark';

/**
 * Pure helpers for the HTTP load and stress test (`load-test-runner.ts`):
 * options, the simulated student workload, latency statistics and the
 * Markdown report.
 */

export interface LoadTestOptions {
  /** Throwaway database the run creates and drops; must end in `_loadtest`. */
  database: string;
  /** Port of the API instance the run starts. */
  port: number;
  resources: number;
  bookings: number;
  students: number;
  /** Students who log in; virtual users share these sessions. */
  sessions: number;
  /** Concurrency levels for the before/after index comparison. */
  levels: number[];
  /** Concurrency steps of the stress ramp. */
  stressLevels: number[];
  /** Seconds measured per stage. */
  duration: number;
  /** Seconds of unmeasured traffic before each stage. */
  warmup: number;
  /** Rounds of the index comparison; the variant order alternates. */
  rounds: number;
  stormSlots: number;
  stormConcurrency: number;
  /** The stress ramp stops after a step above either limit. */
  maxErrorRate: number;
  maxP95: number;
  seed: number;
  envFile: string;
  out?: string;
  keepDatabase: boolean;
}

export const DEFAULT_LOAD_OPTIONS: LoadTestOptions = {
  database: 'web_backend_loadtest',
  port: 18330,
  resources: 1000,
  bookings: 50000,
  students: 1000,
  sessions: 200,
  levels: [1, 10, 50, 100],
  stressLevels: [50, 100, 200, 400, 800, 1600],
  duration: 15,
  warmup: 3,
  rounds: 2,
  stormSlots: 20,
  stormConcurrency: 100,
  maxErrorRate: 0.01,
  maxP95: 2000,
  seed: 0.42,
  envFile: '.env',
  keepDatabase: false,
};

const INTEGER_OPTIONS = [
  'port',
  'resources',
  'bookings',
  'students',
  'sessions',
  'duration',
  'warmup',
  'rounds',
  'stormSlots',
  'stormConcurrency',
  'maxP95',
] as const;

const LIST_OPTIONS = ['levels', 'stressLevels'] as const;

function camelCase(flag: string): string {
  return flag.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function positiveInteger(flag: string, value: string, min: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min) {
    throw new Error(`--${flag} must be an integer >= ${min}`);
  }
  return parsed;
}

/** Parses `--name value` / `--name=value` flags over the defaults. */
export function parseLoadArgs(argv: string[]): LoadTestOptions {
  const options: LoadTestOptions = { ...DEFAULT_LOAD_OPTIONS };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) throw new Error(`Unexpected argument: ${arg}`);
    const [flag, inline] = arg.slice(2).split(/=(.*)/s, 2);
    const key = camelCase(flag);

    if (key === 'keepDatabase') {
      options.keepDatabase = true;
      continue;
    }
    const value = inline ?? argv[(i += 1)];
    if (value === undefined) throw new Error(`--${flag} needs a value`);

    if ((INTEGER_OPTIONS as readonly string[]).includes(key)) {
      const min = key === 'warmup' ? 0 : 1;
      options[key as (typeof INTEGER_OPTIONS)[number]] = positiveInteger(
        flag,
        value,
        min,
      );
    } else if ((LIST_OPTIONS as readonly string[]).includes(key)) {
      const levels = value
        .split(',')
        .map((level) => positiveInteger(flag, level.trim(), 1));
      options[key as (typeof LIST_OPTIONS)[number]] = levels;
    } else if (key === 'maxErrorRate') {
      const parsed = Number(value);
      if (!(parsed >= 0 && parsed <= 1)) {
        throw new Error('--max-error-rate must be between 0 and 1');
      }
      options.maxErrorRate = parsed;
    } else if (key === 'seed') {
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed < -1 || parsed > 1) {
        throw new Error('--seed must be a number between -1 and 1');
      }
      options.seed = parsed;
    } else if (key === 'database') {
      options.database = value;
    } else if (key === 'envFile' || key === 'env') {
      options.envFile = value;
    } else if (key === 'out') {
      options.out = value;
    } else {
      throw new Error(`Unknown option: --${flag}`);
    }
  }

  if (!/^[a-z_][a-z0-9_]*_loadtest$/.test(options.database)) {
    throw new Error(
      '--database must be a lowercase name ending in _loadtest; the run drops and recreates it.',
    );
  }
  return options;
}

/** Deterministic PRNG (mulberry32), so every variant replays the same requests. */
export function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface PlannedRequest {
  name: string;
  method: 'GET' | 'POST';
  path: string;
  body?: Record<string, string>;
  /** Status codes that count as success. */
  expect: number[];
}

export interface WorkloadContext {
  /** Active resources the reads target. */
  resourceIds: string[];
  /** Dates the searches and availability grids ask about. */
  dates: string[];
}

function pick<T>(rng: () => number, values: T[]): T {
  return values[Math.floor(rng() * values.length)];
}

function hour(value: number): string {
  return `${String(value).padStart(2, '0')}:00`;
}

function slotQuery(rng: () => number, context: WorkloadContext): string {
  const start = 8 + Math.floor(rng() * 10);
  return `date=${pick(rng, context.dates)}&startTime=${hour(start)}&endTime=${hour(start + 1)}`;
}

interface ReadKind {
  name: string;
  weight: number;
  path: (rng: () => number, context: WorkloadContext) => string;
}

/** What a student does while looking for a room: mostly searches and grids. */
export const READ_MIX: ReadKind[] = [
  {
    name: 'search: free at slot',
    weight: 30,
    path: (rng, context) =>
      `/resources?${slotQuery(rng, context)}&page=${1 + Math.floor(rng() * 3)}`,
  },
  {
    name: 'search: slot + filters',
    weight: 10,
    path: (rng, context) =>
      `/resources?${slotQuery(rng, context)}&type=laboratory&minCapacity=30&sort=capacity_desc`,
  },
  {
    name: 'browse catalog',
    weight: 15,
    path: (rng) => `/resources?page=${1 + Math.floor(rng() * 20)}`,
  },
  {
    name: 'availability grid',
    weight: 25,
    path: (rng, context) =>
      `/resources/${pick(rng, context.resourceIds)}/availability?date=${pick(rng, context.dates)}`,
  },
  {
    name: 'resource detail',
    weight: 10,
    path: (rng, context) => `/resources/${pick(rng, context.resourceIds)}`,
  },
  { name: 'my bookings', weight: 7, path: () => '/bookings/mine' },
  { name: 'buildings (cached)', weight: 3, path: () => '/resources/buildings' },
];

const READ_MIX_TOTAL = READ_MIX.reduce((sum, kind) => sum + kind.weight, 0);

export function pickRead(
  rng: () => number,
  context: WorkloadContext,
): PlannedRequest {
  let roll = rng() * READ_MIX_TOTAL;
  const kind =
    READ_MIX.find((candidate) => (roll -= candidate.weight) < 0) ??
    READ_MIX[READ_MIX.length - 1];
  return {
    name: kind.name,
    method: 'GET',
    path: kind.path(rng, context),
    expect: [200],
  };
}

/**
 * The k-th booking of the write phase: a distinct one-hour slot on a resource
 * open 07:00-22:00 every day, starting on `firstDate`, so no two collide.
 */
export function uniqueSlot(
  k: number,
  resourceIds: string[],
  firstDate: string,
): { resourceId: string; date: string; startTime: string; endTime: string } {
  const perHour = resourceIds.length;
  const perDay = perHour * 15;
  const day = new Date(`${firstDate}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + Math.floor(k / perDay));
  const start = 7 + Math.floor((k % perDay) / perHour);
  return {
    resourceId: resourceIds[k % perHour],
    date: day.toISOString().slice(0, 10),
    startTime: hour(start),
    endTime: hour(start + 1),
  };
}

export interface Sample {
  name: string;
  ms: number;
  /** HTTP status, or 0 for a network error or timeout. */
  status: number;
  ok: boolean;
}

export interface LatencyStats {
  mean: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
}

export function latencyStats(values: number[]): LatencyStats {
  const sorted = [...values].sort((a, b) => a - b);
  const total = sorted.reduce((sum, value) => sum + value, 0);
  return {
    mean: sorted.length ? total / sorted.length : Number.NaN,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    max: sorted[sorted.length - 1] ?? Number.NaN,
  };
}

export interface EndpointResult {
  name: string;
  requests: number;
  errors: number;
  latency: LatencyStats;
}

export interface StageResult {
  label: string;
  concurrency: number;
  seconds: number;
  requests: number;
  errors: number;
  errorRate: number;
  throughput: number;
  latency: LatencyStats;
  /** Response counts by status; `network` for failed connections. */
  statuses: Record<string, number>;
  endpoints: EndpointResult[];
  /** API process CPU use, where 100 means one full core. */
  serverCpu?: number;
  serverRssMb?: number;
}

export interface StageMeasurement {
  samples: Sample[];
  elapsedMs: number;
  serverCpuSeconds?: number;
  serverRssMb?: number;
}

/** Pools the measurements of repeated runs of the same stage. */
export function mergeMeasurements(runs: StageMeasurement[]): StageMeasurement {
  const cpu = runs.map((run) => run.serverCpuSeconds);
  const rss = runs
    .map((run) => run.serverRssMb)
    .filter((value): value is number => value !== undefined);
  return {
    samples: runs.flatMap((run) => run.samples),
    elapsedMs: runs.reduce((sum, run) => sum + run.elapsedMs, 0),
    serverCpuSeconds: cpu.every((value) => value !== undefined)
      ? cpu.reduce((sum: number, value) => sum + (value ?? 0), 0)
      : undefined,
    serverRssMb: rss.length ? Math.max(...rss) : undefined,
  };
}

export function summarizeStage(
  label: string,
  concurrency: number,
  measurement: StageMeasurement,
): StageResult {
  const { samples, elapsedMs } = measurement;
  const statuses: Record<string, number> = {};
  const groups = new Map<string, Sample[]>();
  for (const sample of samples) {
    const key = sample.status === 0 ? 'network' : String(sample.status);
    statuses[key] = (statuses[key] ?? 0) + 1;
    groups.set(sample.name, [...(groups.get(sample.name) ?? []), sample]);
  }
  const errors = samples.filter((sample) => !sample.ok).length;
  const seconds = elapsedMs / 1000;
  return {
    label,
    concurrency,
    seconds,
    requests: samples.length,
    errors,
    errorRate: samples.length ? errors / samples.length : 0,
    throughput: seconds > 0 ? samples.length / seconds : 0,
    latency: latencyStats(samples.map((sample) => sample.ms)),
    statuses,
    endpoints: [...groups.entries()].map(([name, group]) => ({
      name,
      requests: group.length,
      errors: group.filter((sample) => !sample.ok).length,
      latency: latencyStats(group.map((sample) => sample.ms)),
    })),
    serverCpu:
      measurement.serverCpuSeconds !== undefined && seconds > 0
        ? (measurement.serverCpuSeconds / seconds) * 100
        : undefined,
    serverRssMb: measurement.serverRssMb,
  };
}

/** Why the stress ramp should stop after this step, or null to continue. */
export function stressLimitReached(
  stage: StageResult,
  options: Pick<LoadTestOptions, 'maxErrorRate' | 'maxP95'>,
): string | null {
  if (stage.errorRate > options.maxErrorRate) {
    return `error rate ${formatPercent(stage.errorRate)} exceeded ${formatPercent(options.maxErrorRate)} at ${stage.concurrency} virtual users`;
  }
  if (stage.latency.p95 > options.maxP95) {
    return `p95 ${formatMs(stage.latency.p95)} ms exceeded ${options.maxP95} ms at ${stage.concurrency} virtual users`;
  }
  return null;
}

export interface IndexComparison {
  key: string;
  label: string;
  stages: StageResult[];
}

export interface StormResult {
  slots: number;
  concurrency: number;
  stage: StageResult;
  /** 201 responses per slot. */
  createdPerSlot: number[];
  /** Slot-holding bookings per slot, counted in the database afterwards. */
  rowsPerSlot: number[];
}

export interface LoadTestReport {
  generatedAt: string;
  environment: Record<string, string>;
  dataset: Record<string, string>;
  method: string[];
  login: StageResult;
  indexComparison: IndexComparison[];
  cache: { cached: StageResult; uncached: StageResult };
  writes: StageResult;
  storm: StormResult;
  stress: { stages: StageResult[]; stopReason: string };
  rateLimit: { limit: number; windowSeconds: number; stage: StageResult };
}

export function formatMs(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return value < 100 ? value.toFixed(1) : Math.round(value).toString();
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function formatRate(value: number): string {
  return value < 100 ? value.toFixed(1) : Math.round(value).toString();
}

function formatCpu(stage: StageResult): string {
  return stage.serverCpu === undefined
    ? '—'
    : `${Math.round(stage.serverCpu)}%`;
}

function formatStatuses(stage: StageResult): string {
  return Object.entries(stage.statuses)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([status, count]) => `${status}: ${count}`)
    .join(', ');
}

/** Right-aligns the columns whose cells are all numbers. */
function table(header: string[], rows: string[][]): string {
  const numeric = header.map(
    (_, i) =>
      i > 0 &&
      rows.length > 0 &&
      rows.every((row) => /^[\d.,%×—/ ]+$/.test(row[i] ?? '')),
  );
  return [
    `| ${header.join(' | ')} |`,
    `| ${numeric.map((right) => (right ? '---:' : '---')).join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n');
}

const STAGE_HEADER = [
  'Requests',
  'Throughput (req/s)',
  'p50 (ms)',
  'p95 (ms)',
  'p99 (ms)',
  'Errors',
];

function stageCells(stage: StageResult): string[] {
  return [
    String(stage.requests),
    formatRate(stage.throughput),
    formatMs(stage.latency.p50),
    formatMs(stage.latency.p95),
    formatMs(stage.latency.p99),
    formatPercent(stage.errorRate),
  ];
}

function keyValueTable(values: Record<string, string>): string {
  return table(
    ['', ''],
    Object.entries(values).map(([key, value]) => [key, value]),
  );
}

/** Speed-up of `after` over `before` for a lower-is-better value. */
export function speedup(before: number, after: number): string {
  if (!(before > 0 && after > 0)) return '—';
  return `${(before / after).toFixed(1)}×`;
}

function renderIndexComparison(comparison: IndexComparison[]): string {
  const [before, after] = comparison;
  const rows: string[][] = [];
  before.stages.forEach((stage, i) => {
    for (const variant of comparison) {
      const current = variant.stages[i];
      rows.push([
        String(current.concurrency),
        variant.label,
        ...stageCells(current),
        formatCpu(current),
      ]);
    }
  });

  const top = before.stages.length - 1;
  const endpointRows = before.stages[top].endpoints
    .map((endpoint) => {
      const match = after.stages[top].endpoints.find(
        (candidate) => candidate.name === endpoint.name,
      );
      return { endpoint, match };
    })
    .sort((left, right) => right.endpoint.requests - left.endpoint.requests)
    .map(({ endpoint, match }) => [
      endpoint.name,
      formatMs(endpoint.latency.p50),
      formatMs(match?.latency.p50 ?? Number.NaN),
      formatMs(endpoint.latency.p95),
      formatMs(match?.latency.p95 ?? Number.NaN),
      speedup(endpoint.latency.p95, match?.latency.p95 ?? Number.NaN),
    ]);

  return [
    table(['Virtual users', 'Indexes', ...STAGE_HEADER, 'API CPU'], rows),
    '',
    `Per request type at ${before.stages[top].concurrency} virtual users:`,
    '',
    table(
      [
        'Request',
        `p50 ${before.key} (ms)`,
        `p50 ${after.key} (ms)`,
        `p95 ${before.key} (ms)`,
        `p95 ${after.key} (ms)`,
        'p95 speed-up',
      ],
      endpointRows,
    ),
  ].join('\n');
}

export function renderLoadReport(report: LoadTestReport): string {
  const { storm, stress, rateLimit, cache } = report;
  const exactSlots = storm.createdPerSlot.filter((count) => count === 1).length;
  const exactRows = storm.rowsPerSlot.filter((count) => count === 1).length;
  const allowed = rateLimit.stage.statuses['200'] ?? 0;
  const limited = rateLimit.stage.statuses['429'] ?? 0;

  return [
    '# Load and stress test',
    '',
    `Generated by \`npm run load:test\` on ${report.generatedAt}. Rerunning overwrites this file; see [the benchmarks README](README.md) for how to run it and [the performance comparison](performance-comparison.md) for what the numbers mean.`,
    '',
    '## Environment',
    '',
    keyValueTable(report.environment),
    '',
    '## Dataset',
    '',
    keyValueTable(report.dataset),
    '',
    '## Method',
    '',
    ...report.method.map((line) => `- ${line}`),
    '',
    'Read mix (share of requests): ' +
      READ_MIX.map(
        (kind) =>
          `${kind.name} ${Math.round((kind.weight / READ_MIX_TOTAL) * 100)}%`,
      ).join(', ') +
      '.',
    '',
    '## 1. Before and after the booking indexes',
    '',
    'The mixed read workload, with the three booking lookup indexes from the migrations dropped (`none`) and in place (`migrations`).',
    '',
    renderIndexComparison(report.indexComparison),
    '',
    '## 2. Response cache',
    '',
    '`GET /resources/buildings` is served by the Nest cache interceptor. A unique query string makes every request a cache miss, so the uncached row runs the handler and its database query each time.',
    '',
    table(
      ['Mode', 'Virtual users', ...STAGE_HEADER],
      [cache.cached, cache.uncached].map((stage) => [
        stage.label,
        String(stage.concurrency),
        ...stageCells(stage),
      ]),
    ),
    '',
    `p95 speed-up from the cache: ${speedup(cache.uncached.latency.p95, cache.cached.latency.p95)}; throughput ${formatRate(cache.uncached.throughput)} → ${formatRate(cache.cached.throughput)} req/s.`,
    '',
    '## 3. Booking writes',
    '',
    'Students book distinct free slots (`POST /bookings`), so every request should succeed.',
    '',
    table(
      ['Virtual users', ...STAGE_HEADER, 'API CPU', 'Responses'],
      [
        [
          String(report.writes.concurrency),
          ...stageCells(report.writes),
          formatCpu(report.writes),
          formatStatuses(report.writes),
        ],
      ],
    ),
    '',
    '## 4. Double-booking storm',
    '',
    `${storm.concurrency} students request the same slot at the same moment, repeated for ${storm.slots} different slots. Exactly one request per slot may succeed; the rest must get 409 Conflict.`,
    '',
    table(
      [
        'Requests',
        'p50 (ms)',
        'p95 (ms)',
        'Responses',
        'Slots with one 201',
        'Slots with one booking in the database',
      ],
      [
        [
          String(storm.stage.requests),
          formatMs(storm.stage.latency.p50),
          formatMs(storm.stage.latency.p95),
          formatStatuses(storm.stage),
          `${exactSlots} / ${storm.slots}`,
          `${exactRows} / ${storm.slots}`,
        ],
      ],
    ),
    '',
    '## 5. Stress ramp',
    '',
    'The read mix with the current indexes, raising the number of virtual users until latency or errors pass the limits.',
    '',
    table(
      ['Virtual users', ...STAGE_HEADER, 'API CPU', 'API memory (MB)'],
      stress.stages.map((stage) => [
        String(stage.concurrency),
        ...stageCells(stage),
        formatCpu(stage),
        stage.serverRssMb === undefined
          ? '—'
          : String(Math.round(stage.serverRssMb)),
      ]),
    ),
    '',
    `Result: ${stress.stopReason}.`,
    '',
    '## 6. Login burst',
    '',
    `${report.login.requests} students log in with ${report.login.concurrency} concurrent requests. Login is deliberately slow: bcrypt verifies each password.`,
    '',
    table(
      ['Virtual users', ...STAGE_HEADER],
      [[String(report.login.concurrency), ...stageCells(report.login)]],
    ),
    '',
    '## 7. Rate limiter',
    '',
    `The API restarted with the default limit (${rateLimit.limit} requests per ${rateLimit.windowSeconds} s per client and route), then one client sent ${rateLimit.stage.requests} requests to \`GET /resources\`: ${allowed} were served and ${limited} got 429 Too Many Requests${allowed === rateLimit.limit ? ', as configured' : ''}.`,
    '',
    table(
      ['Requests', 'p50 (ms)', 'p95 (ms)', 'Responses'],
      [
        [
          String(rateLimit.stage.requests),
          formatMs(rateLimit.stage.latency.p50),
          formatMs(rateLimit.stage.latency.p95),
          formatStatuses(rateLimit.stage),
        ],
      ],
    ),
    '',
  ].join('\n');
}
