import { ApiError, apiFetchJson } from './api';
import { clearSensitiveAccessToken, setSensitiveAccessToken } from './session';

export type SensitiveAccessMode = 'PASSWORD' | 'AUTHENTICATOR' | 'EMAIL_OTP';

export type SensitiveAccessState = {
  twoFactorEnabled?: boolean;
  sensitiveAccessActive?: boolean;
  sensitiveAccessExpiresAt?: string;
};

type SensitiveAccessVerifyResponse = {
  sensitiveAccessToken?: string;
  expiresAt?: string;
  verificationMethod?: string;
};

export function isSensitiveAccessRequired(error: unknown) {
  return error instanceof ApiError && error.status === 428;
}

export function clearSensitiveAccessSession() {
  clearSensitiveAccessToken();
}

export function fetchSensitiveAccessState() {
  return apiFetchJson<SensitiveAccessState>('/api/security/sensitive-access/state');
}

export async function verifySensitiveAccess(payload: {
  mode: SensitiveAccessMode;
  password?: string;
  code?: string;
}) {
  const response = await apiFetchJson<SensitiveAccessVerifyResponse>('/api/security/sensitive-access/verify', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (response.sensitiveAccessToken) {
    setSensitiveAccessToken(response.sensitiveAccessToken, response.expiresAt);
  }

  return response;
}

export function sendSensitiveAccessEmailCode() {
  return apiFetchJson<void>('/api/security/sensitive-access/send-email-code', {
    method: 'POST',
  });
}
