import {
  createRng,
  DEFAULT_LOAD_OPTIONS,
  latencyStats,
  LoadTestReport,
  mergeMeasurements,
  parseLoadArgs,
  pickRead,
  READ_MIX,
  renderLoadReport,
  Sample,
  speedup,
  stressLimitReached,
  summarizeStage,
  uniqueSlot,
} from './load-test';

const context = {
  resourceIds: ['r1', 'r2', 'r3'],
  dates: ['2026-10-01', '2026-10-02'],
};

function sample(ms: number, status = 200, name = 'read'): Sample {
  return { name, ms, status, ok: status === 200 };
}

describe('parseLoadArgs', () => {
  it('returns the defaults', () => {
    expect(parseLoadArgs([])).toEqual(DEFAULT_LOAD_OPTIONS);
  });

  it('parses integers, lists, rates and flags', () => {
    const options = parseLoadArgs([
      '--levels',
      '1, 5,20',
      '--stress-levels=10,20',
      '--duration',
      '5',
      '--warmup=0',
      '--max-error-rate',
      '0.05',
      '--keep-database',
      '--out',
      'report.md',
      '--env',
      '.env.test',
    ]);
    expect(options).toMatchObject({
      levels: [1, 5, 20],
      stressLevels: [10, 20],
      duration: 5,
      warmup: 0,
      maxErrorRate: 0.05,
      keepDatabase: true,
      out: 'report.md',
      envFile: '.env.test',
    });
  });

  it.each([
    [['--levels', '10,0'], '--levels must be an integer >= 1'],
    [['--duration', '1.5'], '--duration must be an integer >= 1'],
    [['--max-error-rate', '2'], '--max-error-rate must be between 0 and 1'],
    [['--seed', '3'], '--seed must be a number between -1 and 1'],
    [['--port'], '--port needs a value'],
    [['--unknown', '1'], 'Unknown option: --unknown'],
    [['levels'], 'Unexpected argument: levels'],
  ])('rejects %j', (argv, message) => {
    expect(() => parseLoadArgs(argv)).toThrow(message);
  });

  it.each(['web_backend', 'web_backend_test', 'Web_loadtest', 'x;_loadtest'])(
    'refuses to use %s as the throwaway database',
    (database) => {
      expect(() => parseLoadArgs(['--database', database])).toThrow(
        '--database must be a lowercase name ending in _loadtest',
      );
    },
  );
});

describe('createRng', () => {
  it('is deterministic per seed and stays in [0, 1)', () => {
    const first = createRng(7);
    const second = createRng(7);
    const values = Array.from({ length: 1000 }, () => first());
    expect(values).toEqual(Array.from({ length: 1000 }, () => second()));
    expect(values.every((value) => value >= 0 && value < 1)).toBe(true);
    expect(createRng(8)()).not.toBe(values[0]);
  });
});

describe('pickRead', () => {
  it('follows the weights of the read mix', () => {
    const rng = createRng(1);
    const counts = new Map<string, number>();
    const draws = 20000;
    for (let i = 0; i < draws; i += 1) {
      const { name } = pickRead(rng, context);
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    const total = READ_MIX.reduce((sum, kind) => sum + kind.weight, 0);
    for (const kind of READ_MIX) {
      expect((counts.get(kind.name) ?? 0) / draws).toBeCloseTo(
        kind.weight / total,
        1,
      );
    }
  });

  it('builds valid one-hour slot searches from the context', () => {
    const rng = createRng(2);
    for (let i = 0; i < 500; i += 1) {
      const request = pickRead(rng, context);
      expect(request).toMatchObject({ method: 'GET', expect: [200] });
      const url = new URL(request.path, 'http://api');
      const date = url.searchParams.get('date');
      if (date) expect(context.dates).toContain(date);
      const start = url.searchParams.get('startTime');
      if (start) {
        const hour = Number(start.slice(0, 2));
        expect(start).toMatch(/^\d{2}:00$/);
        expect(url.searchParams.get('endTime')).toBe(
          `${String(hour + 1).padStart(2, '0')}:00`,
        );
        expect(hour).toBeGreaterThanOrEqual(8);
        expect(hour).toBeLessThanOrEqual(17);
      }
    }
  });
});

describe('uniqueSlot', () => {
  it('never repeats a slot and stays inside 07:00-22:00', () => {
    const ids = ['a', 'b', 'c'];
    const seen = new Set<string>();
    for (let k = 0; k < ids.length * 15 * 3; k += 1) {
      const slot = uniqueSlot(k, ids, '2026-11-10');
      const key = `${slot.resourceId} ${slot.date} ${slot.startTime}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
      expect(slot.startTime >= '07:00').toBe(true);
      expect(slot.endTime <= '22:00').toBe(true);
    }
    expect(uniqueSlot(0, ids, '2026-11-10').date).toBe('2026-11-10');
    expect(uniqueSlot(ids.length * 15, ids, '2026-11-10')).toEqual({
      resourceId: 'a',
      date: '2026-11-11',
      startTime: '07:00',
      endTime: '08:00',
    });
  });
});

describe('latencyStats', () => {
  it('uses nearest-rank percentiles', () => {
    const stats = latencyStats(Array.from({ length: 100 }, (_, i) => 100 - i));
    expect(stats).toEqual({ mean: 50.5, p50: 50, p95: 95, p99: 99, max: 100 });
  });

  it('returns NaN without samples', () => {
    expect(latencyStats([]).p95).toBeNaN();
  });
});

describe('summarizeStage', () => {
  it('counts throughput, errors, statuses and per-endpoint latency', () => {
    const stage = summarizeStage('mix', 10, {
      samples: [
        sample(10, 200, 'a'),
        sample(20, 200, 'a'),
        sample(30, 500, 'b'),
        sample(40, 0, 'b'),
      ],
      elapsedMs: 2000,
      serverCpuSeconds: 1,
      serverRssMb: 300,
    });
    expect(stage).toMatchObject({
      requests: 4,
      errors: 2,
      errorRate: 0.5,
      throughput: 2,
      statuses: { '200': 2, '500': 1, network: 1 },
      serverCpu: 50,
      serverRssMb: 300,
    });
    expect(stage.endpoints).toEqual([
      expect.objectContaining({ name: 'a', requests: 2, errors: 0 }),
      expect.objectContaining({ name: 'b', requests: 2, errors: 2 }),
    ]);
  });
});

describe('mergeMeasurements', () => {
  it('pools samples, time and CPU and keeps the peak memory', () => {
    const merged = mergeMeasurements([
      {
        samples: [sample(1)],
        elapsedMs: 1000,
        serverCpuSeconds: 1,
        serverRssMb: 200,
      },
      {
        samples: [sample(2)],
        elapsedMs: 3000,
        serverCpuSeconds: 2,
        serverRssMb: 250,
      },
    ]);
    expect(merged).toEqual({
      samples: [sample(1), sample(2)],
      elapsedMs: 4000,
      serverCpuSeconds: 3,
      serverRssMb: 250,
    });
  });

  it('drops CPU when a run could not measure it', () => {
    expect(
      mergeMeasurements([
        { samples: [], elapsedMs: 1, serverCpuSeconds: 1 },
        { samples: [], elapsedMs: 1 },
      ]).serverCpuSeconds,
    ).toBeUndefined();
  });
});

describe('stressLimitReached', () => {
  const limits = { maxErrorRate: 0.01, maxP95: 1000 };
  const stage = (errors: number, p95: number) =>
    summarizeStage('s', 400, {
      samples: [
        ...Array.from({ length: 100 - errors }, () => sample(p95)),
        ...Array.from({ length: errors }, () => sample(p95, 503)),
      ],
      elapsedMs: 1000,
    });

  it('continues while both limits hold', () => {
    expect(stressLimitReached(stage(1, 1000), limits)).toBeNull();
  });

  it('stops on errors or latency', () => {
    expect(stressLimitReached(stage(2, 10), limits)).toBe(
      'error rate 2.00% exceeded 1.00% at 400 virtual users',
    );
    expect(stressLimitReached(stage(0, 1500), limits)).toBe(
      'p95 1500 ms exceeded 1000 ms at 400 virtual users',
    );
  });
});

describe('speedup', () => {
  it('divides before by after', () => {
    expect(speedup(30, 10)).toBe('3.0×');
    expect(speedup(Number.NaN, 10)).toBe('—');
  });
});

describe('renderLoadReport', () => {
  const stage = (label: string, ms: number, status = 200) =>
    summarizeStage(label, 10, {
      samples: [sample(ms, status, 'search: free at slot')],
      elapsedMs: 1000,
    });

  it('renders every section with the storm and rate-limit verdicts', () => {
    const report: LoadTestReport = {
      generatedAt: '2026-09-26T00:00:00.000Z',
      environment: { 'Node.js': 'v22' },
      dataset: { Bookings: '50000' },
      method: ['Closed loop.'],
      login: stage('login', 500),
      indexComparison: [
        { key: 'none', label: 'none', stages: [stage('none', 40)] },
        { key: 'migrations', label: 'migrations', stages: [stage('m', 20)] },
      ],
      cache: { cached: stage('cached', 5), uncached: stage('miss', 10) },
      writes: stage('writes', 30, 201),
      storm: {
        slots: 2,
        concurrency: 50,
        stage: stage('storm', 60, 409),
        createdPerSlot: [1, 1],
        rowsPerSlot: [1, 1],
      },
      stress: { stages: [stage('s', 90)], stopReason: 'no limit reached' },
      rateLimit: {
        limit: 100,
        windowSeconds: 60,
        stage: summarizeStage('limit', 25, {
          samples: [
            ...Array.from({ length: 100 }, () => sample(5)),
            ...Array.from({ length: 50 }, () => sample(5, 429)),
          ],
          elapsedMs: 1000,
        }),
      },
    };
    const markdown = renderLoadReport(report);
    expect(markdown).toContain('## 1. Before and after the booking indexes');
    expect(markdown).toContain(
      '| search: free at slot | 40.0 | 20.0 | 40.0 | 20.0 | 2.0× |',
    );
    expect(markdown).toContain('p95 speed-up from the cache: 2.0×');
    expect(markdown).toContain('| 2 / 2 | 2 / 2 |');
    expect(markdown).toContain(
      '100 were served and 50 got 429 Too Many Requests, as configured',
    );
    expect(markdown).toContain('Result: no limit reached.');
  });
});
