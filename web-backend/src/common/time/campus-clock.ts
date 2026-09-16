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
