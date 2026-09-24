/**
 * Reads one cookie from a raw `Cookie` header without building a RegExp from
 * the (configurable) cookie name. Returns the URI-decoded value, or null when
 * the cookie is absent, empty, or not decodable.
 */
export function readCookie(
  header: string | undefined,
  name: string,
): string | null {
  if (!header) return null;

  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() !== name) continue;

    const raw = part.slice(separator + 1).trim();
    if (!raw) return null;
    try {
      return decodeURIComponent(raw);
    } catch {
      return null;
    }
  }
  return null;
}
