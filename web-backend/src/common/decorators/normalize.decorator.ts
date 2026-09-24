import { Transform } from 'class-transformer';

/** Trims surrounding whitespace on string input, leaving other types untouched. */
export const TrimString = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );

/**
 * Trims and lowercases string input so an email is stored and looked up in one
 * canonical form. Used by every DTO that accepts an email, which keeps
 * normalisation identical across registration, login, and future flows.
 */
export const NormalizeEmail = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizeEmailAddress(value) : value,
  );

/** The canonical stored form of an email address. */
export function normalizeEmailAddress(value: string): string {
  return value.trim().toLowerCase();
}
