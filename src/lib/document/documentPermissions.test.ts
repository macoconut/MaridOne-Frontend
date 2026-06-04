import { describe, expect, it } from 'vitest';
import { canUploadCompanyDocuments } from './documentPermissions';

function tokenWithRoles(roles: string[]) {
  const header = window.btoa(JSON.stringify({ alg: 'none', typ: 'JWT' })).replace(/=+$/, '');
  const payload = window.btoa(JSON.stringify({ roles })).replace(/=+$/, '');
  return `${header}.${payload}.`;
}

describe('document permissions', () => {
  it('allows company uploads for HR and Management users with matching token roles', () => {
    const hrToken = tokenWithRoles(['ROLE_HR']);
    const managementToken = tokenWithRoles(['ROLE_MANAGEMENT']);

    expect(canUploadCompanyDocuments('hr', hrToken)).toBe(true);
    expect(canUploadCompanyDocuments('management', managementToken)).toBe(true);
  });

  it('rejects company uploads for other roles or mismatched tokens', () => {
    expect(canUploadCompanyDocuments('employee', tokenWithRoles(['ROLE_EMPLOYEE']))).toBe(false);
    expect(canUploadCompanyDocuments('hr', tokenWithRoles(['ROLE_EMPLOYEE']))).toBe(false);
    expect(canUploadCompanyDocuments('management', tokenWithRoles(['ROLE_HR']))).toBe(false);
    expect(canUploadCompanyDocuments('hr', null)).toBe(false);
  });
});
