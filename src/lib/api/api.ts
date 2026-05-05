import {
  clearForcedLogoutMessage,
  clearSession,
  getAuthToken,
  getRequiresPasswordChange,
  getRefreshToken,
  getSensitiveAccessToken,
  setForcedLogoutMessage,
  setAuthToken,
  setRequiresPasswordChange,
  setRefreshToken,
} from '../session';
import type { ErrorResponseDto } from '../types/error';

type ApiLocation = Pick<Location, 'origin' | 'protocol' | 'hostname' | 'port'>;

function normalizeBaseUrl(value: string | null | undefined) {
  const trimmed = value?.trim() ?? '';
  return trimmed.replace(/\/+$/, '');
}

export function resolveApiBaseUrl(
  configuredBaseUrl = import.meta.env.VITE_API_BASE_URL,
  location: ApiLocation | null = typeof window !== 'undefined' ? window.location : null
) {
  const explicitBaseUrl = normalizeBaseUrl(configuredBaseUrl);
  if (explicitBaseUrl) {
    return explicitBaseUrl;
  }

  if (!location) {
    return 'http://localhost:8080';
  }

  // Keep the current hostname in local Vite sessions so emailed links also work off-LAN.
  if (location.port === '5173' || location.port === '4173') {
    return `${location.protocol}//${location.hostname}:8080`;
  }

  const sameOriginBaseUrl = normalizeBaseUrl(location.origin);
  return sameOriginBaseUrl || 'http://localhost:8080';
}

const API_BASE_URL = resolveApiBaseUrl();
let refreshPromise: Promise<boolean> | null = null;
const inflightGetRequests = new Map<string, Promise<Response>>();
let forcedLogoutTimer: number | null = null;
export const FORCED_LOGOUT_EVENT = 'maridone:forced-logout';
const FORCED_LOGOUT_HEADER = 'X-Session-Ended-Reason';
const PORTAL_ACCESS_REMOVED_REASON = 'portal-access-removed';

export class ApiError extends Error {
  status: number;
  code: string;
  timestamp: string;
  rawMessage: string;

  constructor(
    error: ErrorResponseDto,
  ) {
    super(error.message);

    this.name = 'ApiError';

    this.status = error.status;
    this.code = error.code;
    this.timestamp = error.timestamp;

    this.rawMessage = error.message;
  }
}

export function getApiBaseUrl() {
  return API_BASE_URL;
}

export async function expireCurrentSession() {
  const refreshToken = getRefreshToken();

  try {
    if (refreshToken) {
      await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ refreshToken }),
      });
    }
  } catch {
    // Always clear local auth state even if backend logout is unreachable.
  } finally {
    clearSession();
  }
}

function completeLoginRedirect() {
  clearSession();
  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.replace('/login');
  }
}

function triggerForcedLogout(message: string) {
  if (typeof window === 'undefined') {
    completeLoginRedirect();
    return;
  }

  if (forcedLogoutTimer !== null) {
    return;
  }

  setForcedLogoutMessage(message);
  window.dispatchEvent(new CustomEvent(FORCED_LOGOUT_EVENT, { detail: { message } }));
  forcedLogoutTimer = window.setTimeout(() => {
    forcedLogoutTimer = null;
    completeLoginRedirect();
  }, 250);
}

function redirectToLogin(message?: string) {
  if (message) {
    triggerForcedLogout(message);
    return;
  }
  clearForcedLogoutMessage();
  completeLoginRedirect();
}

function isPortalAccessRemovedResponse(response: Response, responseText = '') {
  const reason = response.headers.get(FORCED_LOGOUT_HEADER)?.trim().toLowerCase();
  if (reason === PORTAL_ACCESS_REMOVED_REASON) return true;
  return /portal access has been removed/i.test(responseText.trim());
}

function redirectToPasswordChange() {
  if (typeof window !== 'undefined' && window.location.pathname !== '/change-password') {
    window.location.replace('/change-password');
  }
}

function parseJsonSafely(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function fallbackRequestMessage(fallbackStatus: number) {
  return fallbackStatus > 0 ? `Request failed (${fallbackStatus})` : 'Something went wrong';
}

function toDisplayErrorFromPayload(
  data: unknown,
  fallbackStatus: number,
  rawText = ''
): { message: string } {
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;

    if (typeof obj.message === 'string' && obj.message.trim()) {
      return { message: obj.message.trim() };
    }

    if (typeof obj.error === 'string' && obj.error.trim()) {
      return { message: obj.error.trim() };
    }
  }

  if (rawText && rawText.trim().length <= 250) {
    return { message: rawText.trim() };
  }

  return {
    message: fallbackRequestMessage(fallbackStatus),
  };
}

export function toDisplayError(
  error: unknown,
  fallbackStatus = 0
): { message: string } {
  if (error instanceof ApiError) {
    return {
      message: error.message?.trim() || fallbackRequestMessage(error.status || fallbackStatus),
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message?.trim() || fallbackRequestMessage(fallbackStatus),
    };
  }

  if (typeof error === 'string' && error.trim()) {
    return { message: error.trim() };
  }

  return toDisplayErrorFromPayload(error, fallbackStatus);
}

export function throwApiErrorIfNeeded(response: Response, text: string): void {
  if (response.ok) return;

  const data = parseJsonSafely(text);
  const dto = data && typeof data === 'object' ? (data as Record<string, unknown>) : null;

  const errorDto: ErrorResponseDto = {
    code: typeof dto?.code === 'string' ? dto.code : 'UNKNOWN_ERROR',
    message: typeof dto?.message === 'string' ? dto.message : text || 'Something went wrong',
    status: response.status,
    timestamp: typeof dto?.timestamp === 'string' ? dto.timestamp : new Date().toISOString(),
  };

  throw new ApiError(errorDto);
}

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ refreshToken }),
        });

        if (!response.ok) return false;

        const payload = (await response.json()) as Record<string, unknown>;
        const nextAccessToken =
          typeof payload.accessToken === 'string' ? payload.accessToken : null;
        const nextRefreshToken =
          typeof payload.refreshToken === 'string' ? payload.refreshToken : refreshToken;
        const requiresPasswordChange = payload.requiresPasswordChange === true;

        if (!nextAccessToken) return false;
        setAuthToken(nextAccessToken);
        setRefreshToken(nextRefreshToken);
        setRequiresPasswordChange(requiresPasswordChange);
        return true;
      } catch {
        return false;
      } finally {
        refreshPromise = null;
      }
    })();
  }

  return refreshPromise;
}

export async function apiFetchRaw(path: string, init: RequestInit = {}, allowRetry = true): Promise<Response> {
  const token = getAuthToken();
  const method = String(init.method ?? 'GET').toUpperCase();
  const headers = new Headers(init.headers ?? {});
  const isFormDataBody = typeof FormData !== 'undefined' && init.body instanceof FormData;

  if (!headers.has('Content-Type') && init.body && !isFormDataBody) {
    headers.set('Content-Type', 'application/json');
  }

  if (!headers.has('Authorization') && token && token !== 'authenticated-session') {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const sensitiveAccessToken = getSensitiveAccessToken();
  if (!headers.has('X-Sensitive-Access-Token') && sensitiveAccessToken) {
    headers.set('X-Sensitive-Access-Token', sensitiveAccessToken);
  }

  const requestUrl = `${API_BASE_URL}${path}`;
  const canDeduplicateGet =
    method === 'GET' &&
    allowRetry &&
    !init.body &&
    !init.signal;
  const requestKey = canDeduplicateGet ? `${method} ${requestUrl}` : null;

  const performRequest = async () => {
    const response = await fetch(requestUrl, {
      ...init,
      headers,
      credentials: 'include',
    });

    const responseTextPromise =
      response.status === 401 ? response.clone().text().catch(() => '') : Promise.resolve('');

    if (response.status === 401 && allowRetry && getRefreshToken()) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return apiFetchRaw(path, init, false);
      }
      const forcedLogoutMessage = await responseTextPromise;
      redirectToLogin(
        isPortalAccessRemovedResponse(response, forcedLogoutMessage)
          ? forcedLogoutMessage.trim() || 'Your portal access has been removed. Logging out now.'
          : undefined
      );
    } else if (response.status === 401) {
      const forcedLogoutMessage = await responseTextPromise;
      if (isPortalAccessRemovedResponse(response, forcedLogoutMessage)) {
        redirectToLogin(forcedLogoutMessage.trim() || 'Your portal access has been removed. Logging out now.');
      }
    }

    if (
      response.status === 403 &&
      getRequiresPasswordChange() &&
      path !== '/api/user/password/change' &&
      path !== '/api/auth/logout'
    ) {
      redirectToPasswordChange();
    }

    return response;
  };

  let response: Response;
  if (requestKey) {
    let pending = inflightGetRequests.get(requestKey);
    if (!pending) {
      pending = performRequest().finally(() => {
        inflightGetRequests.delete(requestKey);
      });
      inflightGetRequests.set(requestKey, pending);
    }
    response = (await pending).clone();
  } else {
    response = await performRequest();
  }

  return response;
}

export async function apiFetchJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await apiFetchRaw(path, init);
  const text = await response.text();
  throwApiErrorIfNeeded(response, text);
  const data = parseJsonSafely(text);

  return data as T;
}

export async function apiFetchText(path: string, init: RequestInit = {}): Promise<string> {
  const response = await apiFetchRaw(path, init);
  const text = await response.text();
  throwApiErrorIfNeeded(response, text);
  return text;
}

export function toArray<T>(input: unknown): T[] {
  if (Array.isArray(input)) return input as T[];
  if (input && typeof input === 'object') {
    const content = (input as Record<string, unknown>).content;
    if (Array.isArray(content)) return content as T[];
  }
  return [];
}
