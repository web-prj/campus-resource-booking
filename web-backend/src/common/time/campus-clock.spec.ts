import { campusDateOf, campusTimeOf } from './campus-clock';

describe('campus clock helpers', () => {
  it.each([
    ['2026-09-15T03:30:59.000Z', '2026-09-15', '10:30'],
    ['2026-09-15T16:59:00.000Z', '2026-09-15', '23:59'],
    ['2026-09-15T17:00:00.000Z', '2026-09-16', '00:00'],
    ['2026-12-31T20:15:00.000Z', '2027-01-01', '03:15'],
  ])('maps %s to campus %s %s', (instant, date, time) => {
    expect(campusDateOf(new Date(instant))).toBe(date);
    expect(campusTimeOf(new Date(instant))).toBe(time);
  });
});
