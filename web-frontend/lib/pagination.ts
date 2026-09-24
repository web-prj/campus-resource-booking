/**
 * Reads a 1-based page number from a URL search parameter. Anything other
 * than a single positive safe integer falls back to the first page.
 */
export function parsePageParam(value: string | string[] | undefined): number {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return 1;
  const page = Number(value);
  return Number.isSafeInteger(page) && page >= 1 ? page : 1;
}

export function lastPageFor(totalPages: number): number {
  return Math.max(1, totalPages);
}
