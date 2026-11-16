import { describe, it, expect } from 'vitest';
import { isTokenValid } from '../utils/authUtils';

describe('isTokenValid', () => {
  it('returns false for null token', () => {
    expect(isTokenValid(null)).toBe(false);
  });

  it('returns false for expired token', () => {
    // A JWT with exp in the past
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) - 3600, sub: 'test@test.com' }));
    const expiredToken = `${header}.${payload}.fakesig`;
    expect(isTokenValid(expiredToken)).toBe(false);
  });

  it('returns false for malformed token', () => {
    expect(isTokenValid('not.a.valid.jwt.token')).toBe(false);
  });

  it('accepts an unexpired base64url token (with "-" / "_" and no padding)', () => {
    const b64url = (o: object) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    // "?>?" in the subject forces "+" / "/" in plain base64, i.e. "-" / "_" in base64url.
    const payload = b64url({ exp: Math.floor(Date.now() / 1000) + 3600, sub: '?>?>?>~~~' });
    expect(/[-_]/.test(payload)).toBe(true);
    expect(isTokenValid(`${b64url({ alg: 'HS256' })}.${payload}.sig`)).toBe(true);
  });
});
