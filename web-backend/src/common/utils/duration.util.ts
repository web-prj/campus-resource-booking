/**
 * Duration strings ("15m", "7d") are convenient in env files but useless for
 * `Set-Cookie` max-age, which needs milliseconds. Parsing lives here so the
 * cookie layer and the JWT layer agree on one interpretation.
 */
const DURATION_PATTERN = /^(\d+)(ms|s|m|h|d)$/;

const UNIT_TO_MS: Record<string, number> = {
  ms: 1,
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

/**
 * Converts a duration string such as `15m` or `7d` into milliseconds.
 * Plain digits are treated as seconds, matching how JWT libraries read numbers.
 *
 * @throws Error when the value cannot be interpreted, so a typo in the
 *   environment fails fast at boot instead of silently expiring cookies.
 */
export function durationToMs(value: string): number {
  const normalized = value.trim().toLowerCase();

  if (/^\d+$/.test(normalized)) {
    return Number(normalized) * UNIT_TO_MS.s;
  }

  const match = DURATION_PATTERN.exec(normalized);
  if (!match) {
    throw new Error(
      `Invalid duration "${value}". Use digits with a unit, e.g. 500ms, 30s, 15m, 12h, 7d.`,
    );
  }

  const [, amount, unit] = match;
  return Number(amount) * UNIT_TO_MS[unit];
}
