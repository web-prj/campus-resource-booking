import { hasNoNullByte } from './is-without-null-byte.validator';

describe('hasNoNullByte', () => {
  it.each(['room', 'Campus maintenance', 'whiteboard'])(
    'accepts ordinary text: %s',
    (value) => {
      expect(hasNoNullByte(value)).toBe(true);
    },
  );

  it.each(['room\u0000hidden', '\u0000', 42, null])(
    'rejects a null byte or non-string value: %p',
    (value) => {
      expect(hasNoNullByte(value)).toBe(false);
    },
  );
});
