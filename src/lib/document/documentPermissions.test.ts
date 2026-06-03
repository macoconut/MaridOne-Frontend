import { describe, expect, it } from 'vitest';
import { canUploadCompanyDocuments } from './documentPermissions';

function tokenWithRoles(roles: string[]) {
  const header = window.btoa(JSON.stringify({ alg: 'none', typ: 'JWT' })).replace(/=+$/, '');
  const payload = window.btoa(JSON.stringify({ roles })).replace(/=+$/, '');
  return `${header}.${payload}.`;
}

describe('document permissions', () => {
  it('allows company uploads only for HR users with an HR token role', () => {
    const hrToken = tokenWithRoles(['ROLE_HR']);

    expect(canUploadCompanyDocuments('hr', hrToken)).toBe(true);
  });

  it('rejects company uploads for non-HR roles even when authenticated', () => {
    expect(canUploadCompanyDocuments('management', tokenWithRoles(['ROLE_MANAGEMENT']))).toBe(false);
    expect(canUploadCompanyDocuments('employee', tokenWithRoles(['ROLE_EMPLOYEE']))).toBe(false);
    expect(canUploadCompanyDocuments('hr', tokenWithRoles(['ROLE_EMPLOYEE']))).toBe(false);
    expect(canUploadCompanyDocuments('hr', null)).toBe(false);
  });
});
