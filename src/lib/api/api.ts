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
} from '../utils/session';
import { setGlobalLoadingActive } from '@/context/loadingEvents';
import type { ErrorResponseDto } from '../types/error';

type ApiLocation = Pick<Location, 'origin' | 'protocol' | 'hostname' | 'port'>;
export type ApiFetchInit = RequestInit & {
  globalLoading?: boolean;
};

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
const PASSWORD_CHANGE_REQUIRED_HEADER = 'X-Password-Change-Required';

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

function isHtmlErrorPayload(text: string) {
  const normalized = text.trim().toLowerCase();
  return normalized.startsWith('<!doctype html')
    || normalized.startsWith('<html')
    || normalized.includes('<title>')
    || normalized.includes('<body>');
}

function fallbackMessageForStatus(status: number) {
  switch (status) {
    case 502:
      return 'The server gateway returned an invalid response. Please try again in a moment.';
    case 503:
      return 'The server is temporarily unavailable. Please try again in a moment.';
    case 504:
      return 'The payroll request timed out before the server could finish. Please refresh the payroll runs before trying again.';
    default:
      return fallbackRequestMessage(status);
  }
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

  if (rawText && !isHtmlErrorPayload(rawText) && rawText.trim().length <= 250) {
    return { message: rawText.trim() };
  }

  return {
    message: fallbackMessageForStatus(fallbackStatus),
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
    message: typeof dto?.message === 'string'
      ? dto.message
      : toDisplayErrorFromPayload(data, response.status, text).message,
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

//use for auth related stuff or when you need the raw response for some reason
export async function apiFetchRaw(path: string, init: ApiFetchInit = {}, allowRetry = true): Promise<Response> {
  const { globalLoading = true, ...requestInit } = init;
  const shouldTrackGlobalLoading = globalLoading && allowRetry;
  const token = getAuthToken();
  const method = String(requestInit.method ?? 'GET').toUpperCase();
  const headers = new Headers(requestInit.headers ?? {});
  const isFormDataBody = typeof FormData !== 'undefined' && requestInit.body instanceof FormData;

  if (!headers.has('Content-Type') && requestInit.body && !isFormDataBody) {
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
    !requestInit.body &&
    !requestInit.signal;
  const requestKey = canDeduplicateGet ? `${method} ${requestUrl}` : null;

  const performRequest = async () => {
    const response = await fetch(requestUrl, {
      ...requestInit,
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

    const passwordChangeRequired =
      response.headers.get(PASSWORD_CHANGE_REQUIRED_HEADER)?.trim().toLowerCase() === 'true' ||
      getRequiresPasswordChange();

    if (
      response.status === 403 &&
      passwordChangeRequired &&
      path !== '/api/user/password/change' &&
      path !== '/api/auth/logout'
    ) {
      setRequiresPasswordChange(true);
      redirectToPasswordChange();
    }

    return response;
  };

  if (shouldTrackGlobalLoading) {
    setGlobalLoadingActive(true);
  }

  try {
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
  } finally {
    if (shouldTrackGlobalLoading) {
      setGlobalLoadingActive(false);
    }
  }
}

//use this directly in most cases
export async function apiFetchJson<T>(path: string, init: ApiFetchInit = {}): Promise<T> {
  const response = await apiFetchRaw(path, init);
  const text = await response.text();
  throwApiErrorIfNeeded(response, text);
  const data = parseJsonSafely(text);

  return data as T;
}

//for edge cases
export async function apiFetchText(path: string, init: ApiFetchInit = {}): Promise<string> {
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
