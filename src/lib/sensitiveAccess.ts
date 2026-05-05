import { ApiError, apiFetchJson } from './api/api';
import { clearSensitiveAccessToken, setSensitiveAccessToken } from './session';

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

export async function verifySensitiveAccess(payload: { password: string }) {
  const response = await apiFetchJson<SensitiveAccessVerifyResponse>('/api/security/sensitive-access/verify', {
    method: 'POST',
    body: JSON.stringify({
      mode: 'PASSWORD',
      password: payload.password,
    }),
  });

  if (response.sensitiveAccessToken) {
    setSensitiveAccessToken(response.sensitiveAccessToken, response.expiresAt);
  }

  return response;
}
