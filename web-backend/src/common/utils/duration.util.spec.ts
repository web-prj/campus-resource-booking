import { durationToMs, DurationString, parseDuration } from './duration.util';

describe('parseDuration', () => {
  it.each([
    ['500ms', '500ms'],
    ['30s', '30s'],
    ['15M', '15m'],
    ['  12H  ', '12h'],
    ['60', '60'],
  ])('normalizes %p to %p', (input, expected) => {
    const duration: DurationString = parseDuration(input);
    expect(duration).toBe(expected);
  });

  it.each(['', 'soon', '-5m', '5 m', 'm15'])('rejects %p', (input) => {
    expect(() => parseDuration(input)).toThrow(/Invalid duration/);
  });
});

describe('durationToMs', () => {
  it.each([
    ['500ms', 500],
    ['30s', 30_000],
    ['15m', 900_000],
    ['12h', 43_200_000],
    ['7d', 604_800_000],
  ])('converts %s', (input, expected) => {
    expect(durationToMs(input)).toBe(expected);
  });

  it('treats a bare number as seconds, like JWT libraries do', () => {
    expect(durationToMs('60')).toBe(60_000);
  });

  it('ignores surrounding whitespace and casing', () => {
    expect(durationToMs('  15M  ')).toBe(900_000);
  });

  it.each(['', 'soon', '15', '-5m', '5 m', 'm15'].filter((v) => v !== '15'))(
    'rejects %p',
    (input) => {
      expect(() => durationToMs(input)).toThrow(/Invalid duration/);
    },
  );
});
