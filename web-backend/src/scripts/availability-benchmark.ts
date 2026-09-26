/**
 * Pure helpers for the availability-query benchmark
 * (`availability-benchmark-runner.ts`): options, the index variants under
 * test, timing statistics, EXPLAIN plan summaries and the Markdown report.
 */

/** Booking statuses that hold a slot; keep in sync with the bookings module. */
export const BLOCKING_STATUSES = ['pending', 'confirmed', 'checked_in'];

export interface BenchmarkOptions {
  resources: number;
  bookings: number;
  pastDays: number;
  futureDays: number;
  iterations: number;
  warmup: number;
  rounds: number;
  explainRuns: number;
  seed: number;
  envFile: string;
  out?: string;
  allowAnyDatabase: boolean;
}

export const DEFAULT_OPTIONS: BenchmarkOptions = {
  resources: 1000,
  bookings: 50000,
  pastDays: 60,
  futureDays: 30,
  iterations: 40,
  warmup: 5,
  rounds: 3,
  explainRuns: 5,
  seed: 0.42,
  envFile: '.env',
  allowAnyDatabase: false,
};

/** The scenarios query this many days after the campus date of the run. */
export const SCENARIO_DAYS_AHEAD = 7;

/** Bookable hours per resource-day in the synthetic catalog (07:00-22:00). */
const MAX_SLOTS_PER_RESOURCE_DAY = 15;

const INTEGER_OPTIONS = [
  'resources',
  'bookings',
  'pastDays',
  'futureDays',
  'iterations',
  'warmup',
  'rounds',
  'explainRuns',
] as const;

function camelCase(flag: string): string {
  return flag.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

/** Parses `--name value` / `--name=value` flags over {@link DEFAULT_OPTIONS}. */
export function parseArgs(argv: string[]): BenchmarkOptions {
  const options: BenchmarkOptions = { ...DEFAULT_OPTIONS };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) throw new Error(`Unexpected argument: ${arg}`);
    const [flag, inline] = arg.slice(2).split(/=(.*)/s, 2);
    const key = camelCase(flag);

    if (key === 'allowAnyDatabase') {
      options.allowAnyDatabase = true;
      continue;
    }
    const value = inline ?? argv[(i += 1)];
    if (value === undefined) throw new Error(`--${flag} needs a value`);

    if ((INTEGER_OPTIONS as readonly string[]).includes(key)) {
      const parsed = Number(value);
      const min = key === 'warmup' || key === 'pastDays' ? 0 : 1;
      if (!Number.isInteger(parsed) || parsed < min) {
        throw new Error(`--${flag} must be an integer >= ${min}`);
      }
      options[key as (typeof INTEGER_OPTIONS)[number]] = parsed;
    } else if (key === 'seed') {
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed < -1 || parsed > 1) {
        throw new Error('--seed must be a number between -1 and 1');
      }
      options.seed = parsed;
    } else if (key === 'envFile' || key === 'env') {
      options.envFile = value;
    } else if (key === 'out') {
      options.out = value;
    } else {
      throw new Error(`Unknown option: --${flag}`);
    }
  }

  if (options.futureDays < SCENARIO_DAYS_AHEAD) {
    throw new Error(
      `--future-days must be at least ${SCENARIO_DAYS_AHEAD} to cover the scenario date`,
    );
  }
  const days = options.pastDays + options.futureDays + 1;
  const capacity = options.resources * days * MAX_SLOTS_PER_RESOURCE_DAY;
  // Leave headroom for resources with shorter hours or fewer operating days.
  if (options.bookings > capacity / 2) {
    throw new Error(
      `--bookings ${options.bookings} is too dense for ${options.resources} resources over ${days} days; use at most ${Math.floor(capacity / 2)}.`,
    );
  }
  return options;
}

export interface ManagedIndex {
  name: string;
  definition: string;
  origin: 'migration' | 'candidate';
}

const BLOCKING_PREDICATE = `status IN (${BLOCKING_STATUSES.map((status) => `'${status}'`).join(', ')})`;

/**
 * Booking indexes the benchmark adds or removes per variant. Everything else
 * (primary key, the GiST exclusion constraint, the pending-queue index) stays.
 */
export const MANAGED_INDEXES: ManagedIndex[] = [
  {
    name: 'IDX_bookings_resource_date',
    definition:
      'CREATE INDEX "IDX_bookings_resource_date" ON bookings (resource_id, booking_date)',
    origin: 'migration',
  },
  {
    name: 'IDX_bookings_analytics_date_status_resource',
    definition:
      'CREATE INDEX "IDX_bookings_analytics_date_status_resource" ON bookings (booking_date, status, resource_id)',
    origin: 'migration',
  },
  {
    name: 'IDX_bookings_operations_date_status',
    definition: `CREATE INDEX "IDX_bookings_operations_date_status" ON bookings (booking_date, start_time, status) WHERE status IN ('confirmed', 'checked_in')`,
    origin: 'migration',
  },
  {
    name: 'IDX_bookings_availability_check',
    definition:
      'CREATE INDEX "IDX_bookings_availability_check" ON bookings (booking_date, status, start_time, end_time, resource_id)',
    origin: 'candidate',
  },
  {
    name: 'IDX_bookings_blocking_resource_date',
    definition: `CREATE INDEX "IDX_bookings_blocking_resource_date" ON bookings (resource_id, booking_date, start_time, end_time) WHERE ${BLOCKING_PREDICATE}`,
    origin: 'candidate',
  },
];

export interface IndexVariant {
  key: string;
  label: string;
  indexes: string[];
}

const MIGRATION_INDEXES = MANAGED_INDEXES.filter(
  (index) => index.origin === 'migration',
).map((index) => index.name);

export const INDEX_VARIANTS: IndexVariant[] = [
  {
    key: 'none',
    label: 'No booking lookup indexes',
    indexes: [],
  },
  {
    key: 'migrations',
    label: 'Current migrations',
    indexes: MIGRATION_INDEXES,
  },
  {
    key: 'availability-check',
    label: 'Migrations + IDX_bookings_availability_check',
    indexes: [...MIGRATION_INDEXES, 'IDX_bookings_availability_check'],
  },
  {
    key: 'blocking-partial',
    label: 'Migrations + IDX_bookings_blocking_resource_date',
    indexes: [...MIGRATION_INDEXES, 'IDX_bookings_blocking_resource_date'],
  },
];

export function indexDefinition(name: string): string {
  const index = MANAGED_INDEXES.find((candidate) => candidate.name === name);
  if (!index) throw new Error(`Unknown managed index: ${name}`);
  return index.definition;
}

export interface TimingSummary {
  mean: number;
  p50: number;
  p95: number;
  min: number;
  max: number;
}

/** Nearest-rank percentile of an ascending array. */
export function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return Number.NaN;
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length, Math.max(1, rank)) - 1];
}

export function summarizeTimings(samples: number[]): TimingSummary {
  const sorted = [...samples].sort((a, b) => a - b);
  const total = sorted.reduce((sum, value) => sum + value, 0);
  return {
    mean: sorted.length ? total / sorted.length : Number.NaN,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    min: sorted[0] ?? Number.NaN,
    max: sorted[sorted.length - 1] ?? Number.NaN,
  };
}

interface PlanNode {
  'Node Type'?: string;
  'Relation Name'?: string;
  'Index Name'?: string;
  'Actual Loops'?: number;
  'Shared Hit Blocks'?: number;
  'Shared Read Blocks'?: number;
  Plans?: PlanNode[];
}

export interface ExplainOutput {
  Plan: PlanNode;
  'Planning Time': number;
  'Execution Time': number;
}

export interface PlanSummary {
  executionMs: number;
  planningMs: number;
  sharedBlocks: number;
  /** How each statement reads `bookings`, e.g. "Index Scan using X ×1000". */
  bookingsAccess: string[];
}

/** Index names read by the Bitmap Index Scans under a Bitmap Heap Scan. */
function bitmapIndexes(node: PlanNode): string[] {
  return (node.Plans ?? []).flatMap((child) =>
    child['Node Type'] === 'Bitmap Index Scan' && child['Index Name']
      ? [child['Index Name']]
      : bitmapIndexes(child),
  );
}

function bookingsAccess(node: PlanNode, found: string[]): void {
  if (node['Relation Name'] === 'bookings') {
    const indexes = node['Index Name']
      ? [node['Index Name']]
      : bitmapIndexes(node);
    const via = indexes.length ? ` using ${indexes.join(' + ')}` : '';
    const loops = node['Actual Loops'] ?? 1;
    found.push(`${node['Node Type']}${via}${loops > 1 ? ` ×${loops}` : ''}`);
  }
  for (const child of node.Plans ?? []) bookingsAccess(child, found);
}

/** Combines the EXPLAIN (ANALYZE, BUFFERS) output of one scenario's queries. */
export function summarizePlans(plans: ExplainOutput[]): PlanSummary {
  const access: string[] = [];
  for (const plan of plans) bookingsAccess(plan.Plan, access);
  return {
    executionMs: plans.reduce((sum, plan) => sum + plan['Execution Time'], 0),
    planningMs: plans.reduce((sum, plan) => sum + plan['Planning Time'], 0),
    sharedBlocks: plans.reduce(
      (sum, plan) =>
        sum +
        (plan.Plan['Shared Hit Blocks'] ?? 0) +
        (plan.Plan['Shared Read Blocks'] ?? 0),
      0,
    ),
    bookingsAccess: [...new Set(access)],
  };
}

export function median(values: number[]): number {
  return percentile(
    [...values].sort((a, b) => a - b),
    50,
  );
}

/** Median timings and blocks over repeated EXPLAIN runs; union of access paths. */
export function combinePlanRuns(runs: PlanSummary[]): PlanSummary {
  return {
    executionMs: median(runs.map((run) => run.executionMs)),
    planningMs: median(runs.map((run) => run.planningMs)),
    sharedBlocks: median(runs.map((run) => run.sharedBlocks)),
    bookingsAccess: [...new Set(runs.flatMap((run) => run.bookingsAccess))],
  };
}

export interface ScenarioResult {
  scenario: string;
  variant: string;
  timings: TimingSummary;
  plan: PlanSummary;
  /** Result fingerprint; must match across variants. */
  fingerprint: string;
}

export interface BenchmarkReport {
  generatedAt: string;
  environment: Record<string, string>;
  dataset: Record<string, string>;
  scenarios: { name: string; description: string }[];
  variants: IndexVariant[];
  results: ScenarioResult[];
  mismatches: string[];
}

function ms(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2) : '-';
}

function ratio(base: number, value: number): string {
  if (!Number.isFinite(base) || !Number.isFinite(value) || value <= 0) {
    return '-';
  }
  return `${(base / value).toFixed(2)}×`;
}

function keyValueTable(rows: Record<string, string>): string[] {
  return [
    '| | |',
    '|---|---|',
    ...Object.entries(rows).map(([key, value]) => `| ${key} | ${value} |`),
  ];
}

export function renderReport(report: BenchmarkReport): string {
  const lines: string[] = [
    '# Availability query benchmark',
    '',
    `Generated ${report.generatedAt} by \`npm run bench:availability\` (web-backend). Re-run it to refresh this file; see the options in \`src/scripts/availability-benchmark-runner.ts\`.`,
    '',
    'The benchmark seeds a synthetic catalog and booking history inside one transaction, times the real `ResourcesService` read paths under several booking-index variants, and rolls everything back, so the database is left unchanged.',
    '',
    '## Environment',
    '',
    ...keyValueTable(report.environment),
    '',
    '## Dataset',
    '',
    ...keyValueTable(report.dataset),
    '',
    '## Scenarios',
    '',
    ...report.scenarios.map(
      (scenario) => `- **${scenario.name}**: ${scenario.description}`,
    ),
    '',
    '## Index variants',
    '',
    ...report.variants.map(
      (variant) =>
        `- **${variant.key}** (${variant.label}): ${variant.indexes.length ? variant.indexes.map((name) => `\`${name}\``).join(', ') : 'only the primary key, the GiST exclusion constraint and the pending-queue index'}`,
    ),
    '',
    '## Results',
    '',
    'Service times are wall-clock milliseconds per call through `ResourcesService` (TypeORM query building, round trips and entity mapping; no HTTP), pooled over all rounds. DB time is the median `EXPLAIN ANALYZE` execution time of the SQL one call issues, summed over its statements, and blocks are the shared buffers those statements touched.',
  ];

  for (const scenario of report.scenarios) {
    const rows = report.results.filter(
      (result) => result.scenario === scenario.name,
    );
    const baseline = rows.find((row) => row.variant === 'none');
    lines.push(
      '',
      `### ${scenario.name}`,
      '',
      '| Variant | p50 | p95 | mean | DB time | Blocks | vs none (p50) | Bookings access |',
      '|---|---:|---:|---:|---:|---:|---:|---|',
      ...rows.map(
        (row) =>
          `| ${row.variant} | ${ms(row.timings.p50)} | ${ms(row.timings.p95)} | ${ms(row.timings.mean)} | ${ms(row.plan.executionMs)} | ${row.plan.sharedBlocks} | ${baseline ? ratio(baseline.timings.p50, row.timings.p50) : '-'} | ${row.plan.bookingsAccess.join('; ') || 'not read'} |`,
      ),
    );
  }

  lines.push(
    '',
    '## Result consistency',
    '',
    report.mismatches.length
      ? `Results differed between variants: ${report.mismatches.join('; ')}.`
      : 'Every scenario returned identical results under every index variant.',
    '',
  );
  return lines.join('\n');
}
