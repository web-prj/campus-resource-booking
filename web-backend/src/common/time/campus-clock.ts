export const CAMPUS_CLOCK = Symbol('CAMPUS_CLOCK');
export const CAMPUS_UTC_OFFSET = '+07:00';

export type CampusClock = () => Date;

export function campusDateTimeMs(date: string, time: string): number {
  return new Date(`${date}T${time}:00${CAMPUS_UTC_OFFSET}`).getTime();
}

export function isFutureCampusTime(
  date: string,
  time: string,
  now: Date,
): boolean {
  const timestamp = campusDateTimeMs(date, time);
  return Number.isFinite(timestamp) && timestamp > now.getTime();
}

const CAMPUS_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Campus-local calendar date (`YYYY-MM-DD`) for an instant. */
export function campusDateOf(now: Date): string {
  return new Date(now.getTime() + CAMPUS_OFFSET_MS).toISOString().slice(0, 10);
}

/** Campus-local wall-clock time (`HH:MM`, seconds truncated) for an instant. */
export function campusTimeOf(now: Date): string {
  return new Date(now.getTime() + CAMPUS_OFFSET_MS).toISOString().slice(11, 16);
}
