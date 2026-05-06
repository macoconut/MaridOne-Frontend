import { apiFetchJson, apiFetchText, getApiBaseUrl, throwApiErrorIfNeeded } from '../api/api';

export type TwoFactorSetupResponse = {
  qrCodeImageUri?: string;
  manualSecret?: string;
};

export function sendEmailVerification() {
  return apiFetchJson<void>('/api/settings/send-email-verification', {
    method: 'POST',
  });
}

export function beginTwoFactorSetup() {
  return apiFetchJson<TwoFactorSetupResponse>('/api/settings/2fa/enable', {
    method: 'POST',
  });
}

export function confirmTwoFactorSetup(code: string) {
  return apiFetchText('/api/settings/2fa/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: code.trim(),
  });
}

export function disableTwoFactor() {
  return apiFetchJson<void>('/api/settings/2fa/disable', {
    method: 'POST',
  });
}

export function changeOwnPassword(currentPassword: string, newPassword: string) {
  return apiFetchText('/api/user/password/change', {
    method: 'PATCH',
    body: JSON.stringify({
      currentPassword,
      newPassword,
    }),
  });
}

export function verifyEmailToken(token: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers ?? {});
  headers.set('Content-Type', 'text/plain');

  return fetch(`${getApiBaseUrl()}/api/auth/verify-email`, {
    ...init,
    method: 'POST',
    headers,
    body: token.trim(),
  }).then(async (response) => {
    const text = await response.text();

    if (!response.ok) {
      throw throwApiErrorIfNeeded(response, text);
    }

    return text;
  });
}
