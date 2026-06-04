import { describe, expect, it } from 'vitest';

import {
  buildLoginRedirectPathForPath,
  getPostAuthRedirectPath,
} from './authRedirect';

describe('authRedirect', () => {
  it('carries an internal protected path to the login page', () => {
    expect(buildLoginRedirectPathForPath('/employee/attendance?request=leave')).toBe(
      '/login?next=%2Femployee%2Fattendance%3Frequest%3Dleave'
    );
    expect(buildLoginRedirectPathForPath('/login')).toBe('/login');
    expect(buildLoginRedirectPathForPath('//example.com/login')).toBe('/login');
    expect(buildLoginRedirectPathForPath('https://example.com/login')).toBe('/login');
  });

  it('returns users to a requested path only inside their own role area', () => {
    expect(
      getPostAuthRedirectPath(
        'employee',
        false,
        { search: '?next=%2Femployee%2Fattendance%3Frequest%3Dleave' },
        '/employee/dashboard'
      )
    ).toBe('/employee/attendance?request=leave');

    expect(
      getPostAuthRedirectPath(
        'hr',
        false,
        { search: '?next=%2Femployee%2Fattendance' },
        '/hr/self-service/dashboard'
      )
    ).toBe('/hr/self-service/dashboard');
  });

  it('keeps password-change-required users on the password change flow', () => {
    expect(
      getPostAuthRedirectPath(
        'employee',
        true,
        { search: '?next=%2Femployee%2Fattendance' },
        '/employee/dashboard'
      )
    ).toBe('/change-password');
  });
});
