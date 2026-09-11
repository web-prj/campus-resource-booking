import { hasMaxUtf8ByteLength } from './max-utf8-byte-length.validator';

describe('hasMaxUtf8ByteLength', () => {
  it('accepts a value at the byte limit', () => {
    expect(hasMaxUtf8ByteLength('a'.repeat(72), 72)).toBe(true);
  });

  it('rejects ASCII beyond the byte limit', () => {
    expect(hasMaxUtf8ByteLength('a'.repeat(73), 72)).toBe(false);
  });

  it('counts multibyte characters by encoded bytes, not code points', () => {
    expect(hasMaxUtf8ByteLength('ế'.repeat(24), 72)).toBe(true);
    expect(hasMaxUtf8ByteLength('ế'.repeat(25), 72)).toBe(false);
  });

  it('rejects non-string values', () => {
    expect(hasMaxUtf8ByteLength(undefined, 72)).toBe(false);
  });
});
