import { readCookie } from './cookie.util';

describe('readCookie', () => {
  it('returns the named cookie value, decoded', () => {
    expect(readCookie('a=1; access_token=abc%2Edef; b=2', 'access_token')).toBe(
      'abc.def',
    );
    expect(readCookie('access_token=first', 'access_token')).toBe('first');
  });

  it('treats the cookie name literally rather than as a pattern', () => {
    expect(readCookie('axb=wrong; a.b=right', 'a.b')).toBe('right');
    expect(readCookie('aaaa=wrong', 'a+')).toBeNull();
    expect(readCookie('x_access_token=wrong', 'access_token')).toBeNull();
  });

  it('returns null for missing, empty, or undecodable values', () => {
    expect(readCookie(undefined, 'access_token')).toBeNull();
    expect(readCookie('', 'access_token')).toBeNull();
    expect(readCookie('other=1', 'access_token')).toBeNull();
    expect(readCookie('access_token=', 'access_token')).toBeNull();
    expect(readCookie('access_token=%E0%A4%A', 'access_token')).toBeNull();
    expect(readCookie('broken; access_token=ok', 'access_token')).toBe('ok');
  });
});
