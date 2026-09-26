import {
  BenchmarkReport,
  DEFAULT_OPTIONS,
  ExplainOutput,
  INDEX_VARIANTS,
  MANAGED_INDEXES,
  combinePlanRuns,
  indexDefinition,
  parseArgs,
  percentile,
  renderReport,
  summarizePlans,
  summarizeTimings,
} from './availability-benchmark';

describe('parseArgs', () => {
  it('returns the defaults without flags', () => {
    expect(parseArgs([])).toEqual(DEFAULT_OPTIONS);
  });

  it('reads kebab-case flags in both spellings', () => {
    const options = parseArgs([
      '--resources',
      '200',
      '--bookings=5000',
      '--past-days',
      '10',
      '--explain-runs=2',
      '--env',
      '.env.test',
      '--out',
      'report.md',
      '--allow-any-database',
    ]);
    expect(options).toMatchObject({
      resources: 200,
      bookings: 5000,
      pastDays: 10,
      explainRuns: 2,
      envFile: '.env.test',
      out: 'report.md',
      allowAnyDatabase: true,
    });
  });

  it('lets a later flag override an earlier one', () => {
    expect(parseArgs(['--env', '.env.test', '--env', '.env']).envFile).toBe(
      '.env',
    );
  });

  it.each([
    [['--resources', '0'], '--resources must be an integer >= 1'],
    [['--iterations', '2.5'], '--iterations must be an integer >= 1'],
    [['--warmup', '-1'], '--warmup must be an integer >= 0'],
    [['--future-days', '6'], '--future-days must be at least 7'],
    [['--seed', '2'], '--seed must be a number between -1 and 1'],
    [['--rounds'], '--rounds needs a value'],
    [['--nope', '1'], 'Unknown option: --nope'],
    [['stray'], 'Unexpected argument: stray'],
  ])('rejects %j', (argv, message) => {
    expect(() => parseArgs(argv)).toThrow(message);
  });

  it('rejects more bookings than the synthetic slots can hold', () => {
    expect(() =>
      parseArgs([
        '--resources',
        '1',
        '--past-days',
        '0',
        '--future-days',
        '7',
        '--bookings',
        '61',
      ]),
    ).toThrow('too dense');
  });
});

describe('index variants', () => {
  it('only reference managed indexes', () => {
    const names = new Set(MANAGED_INDEXES.map((index) => index.name));
    for (const variant of INDEX_VARIANTS) {
      for (const name of variant.indexes) expect(names.has(name)).toBe(true);
    }
  });

  it('keep the migration indexes in every variant except the baseline', () => {
    const migrations = MANAGED_INDEXES.filter(
      (index) => index.origin === 'migration',
    ).map((index) => index.name);
    for (const variant of INDEX_VARIANTS.filter((v) => v.key !== 'none')) {
      expect(variant.indexes).toEqual(expect.arrayContaining(migrations));
    }
    expect(INDEX_VARIANTS.find((v) => v.key === 'none')?.indexes).toEqual([]);
  });

  it('builds CREATE INDEX statements named after the index', () => {
    for (const index of MANAGED_INDEXES) {
      expect(indexDefinition(index.name)).toMatch(
        new RegExp(`^CREATE INDEX "${index.name}" ON bookings `),
      );
    }
    expect(() => indexDefinition('IDX_missing')).toThrow('Unknown');
  });
});

describe('timing statistics', () => {
  it('uses nearest-rank percentiles', () => {
    const sorted = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(percentile(sorted, 50)).toBe(5);
    expect(percentile(sorted, 95)).toBe(10);
    expect(percentile([7], 95)).toBe(7);
    expect(percentile([], 50)).toBeNaN();
  });

  it('summarizes unsorted samples', () => {
    expect(summarizeTimings([4, 1, 3, 2])).toEqual({
      mean: 2.5,
      p50: 2,
      p95: 4,
      min: 1,
      max: 4,
    });
  });
});

describe('plan summaries', () => {
  const plan = (
    executionMs: number,
    root: ExplainOutput['Plan'],
  ): ExplainOutput => ({
    Plan: root,
    'Planning Time': 0.5,
    'Execution Time': executionMs,
  });

  it('lists how bookings is read, including bitmap indexes and loops', () => {
    const summary = summarizePlans([
      plan(3, {
        'Node Type': 'Hash Anti Join',
        'Shared Hit Blocks': 40,
        'Shared Read Blocks': 2,
        Plans: [
          { 'Node Type': 'Seq Scan', 'Relation Name': 'resources' },
          {
            'Node Type': 'Bitmap Heap Scan',
            'Relation Name': 'bookings',
            Plans: [
              {
                'Node Type': 'Bitmap Index Scan',
                'Index Name': 'IDX_bookings_availability_check',
              },
            ],
          },
        ],
      }),
      plan(1, {
        'Node Type': 'Nested Loop Anti Join',
        'Shared Hit Blocks': 8,
        Plans: [
          {
            'Node Type': 'Index Scan',
            'Relation Name': 'bookings',
            'Index Name': 'IDX_bookings_resource_date',
            'Actual Loops': 9,
          },
        ],
      }),
    ]);
    expect(summary).toEqual({
      executionMs: 4,
      planningMs: 1,
      sharedBlocks: 50,
      bookingsAccess: [
        'Bitmap Heap Scan using IDX_bookings_availability_check',
        'Index Scan using IDX_bookings_resource_date ×9',
      ],
    });
  });

  it('reports statements that never read bookings', () => {
    expect(
      summarizePlans([plan(2, { 'Node Type': 'Seq Scan' })]).bookingsAccess,
    ).toEqual([]);
  });

  it('takes medians across repeated EXPLAIN runs', () => {
    const run = (executionMs: number, access: string) => ({
      executionMs,
      planningMs: executionMs / 10,
      sharedBlocks: 10,
      bookingsAccess: [access],
    });
    expect(
      combinePlanRuns([run(9, 'A'), run(1, 'A'), run(3, 'B')]),
    ).toMatchObject({
      executionMs: 3,
      sharedBlocks: 10,
      bookingsAccess: ['A', 'B'],
    });
  });
});

describe('renderReport', () => {
  const timings = { mean: 10, p50: 10, p95: 12, min: 8, max: 14 };
  const planSummary = {
    executionMs: 5,
    planningMs: 1,
    sharedBlocks: 100,
    bookingsAccess: ['Seq Scan'],
  };
  const report: BenchmarkReport = {
    generatedAt: '2026-09-25T00:00:00.000Z',
    environment: { PostgreSQL: '16.15' },
    dataset: { Bookings: '50000' },
    scenarios: [{ name: 'discover: free at slot', description: 'Main query.' }],
    variants: INDEX_VARIANTS.slice(0, 2),
    results: [
      {
        scenario: 'discover: free at slot',
        variant: 'none',
        timings,
        plan: planSummary,
        fingerprint: 'a',
      },
      {
        scenario: 'discover: free at slot',
        variant: 'migrations',
        timings: { ...timings, p50: 4 },
        plan: { ...planSummary, bookingsAccess: [] },
        fingerprint: 'a',
      },
    ],
    mismatches: [],
  };

  it('renders a per-scenario table with speed-ups against the baseline', () => {
    const markdown = renderReport(report);
    expect(markdown).toContain('### discover: free at slot');
    expect(markdown).toContain(
      '| none | 10.00 | 12.00 | 10.00 | 5.00 | 100 | 1.00× | Seq Scan |',
    );
    expect(markdown).toContain(
      '| migrations | 4.00 | 12.00 | 10.00 | 5.00 | 100 | 2.50× | not read |',
    );
    expect(markdown).toContain('identical results under every index variant');
  });

  it('calls out scenarios whose results differed', () => {
    expect(
      renderReport({ ...report, mismatches: ['discover: free at slot'] }),
    ).toContain('Results differed between variants: discover: free at slot.');
  });
});
