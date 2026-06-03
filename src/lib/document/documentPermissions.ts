import type { UserRole } from '@/lib/utils/session';

function parseJwtPayload(token: string | null): Record<string, unknown> | null {
  if (!token || token === 'authenticated-session') return null;

  const [, payload] = token.split('.');
  if (!payload) return null;

  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    return JSON.parse(window.atob(padded)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function tokenHasRole(token: string | null, roleToMatch: string) {
  const payload = parseJwtPayload(token);
  const roles = payload?.roles;
  return Array.isArray(roles) && roles.includes(roleToMatch);
}

export function canUploadCompanyDocuments(role: UserRole | null, token: string | null) {
  return role === 'hr' && tokenHasRole(token, 'ROLE_HR');
}
