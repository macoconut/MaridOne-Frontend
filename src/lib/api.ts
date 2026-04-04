import {
  clearSession,
  getAuthToken,
  getRefreshToken,
  setAuthToken,
  setRefreshToken,
} from './session';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080';
let refreshPromise: Promise<boolean> | null = null;

export class ApiError extends Error {
  status: number;
  rawMessage: string;
  details: string[];

  constructor(status: number, message: string, rawMessage = message, details: string[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.rawMessage = rawMessage;
    this.details = details;
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

function redirectToLogin() {
  clearSession();
  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.replace('/login');
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

function extractErrorMessage(data: unknown, fallbackStatus: number, rawText: string): string {
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;

    if (typeof obj.message === 'string' && obj.message.trim().length > 0) {
      return obj.message;
    }

    if (typeof obj.error === 'string' && obj.error.trim().length > 0) {
      return obj.error;
    }

    if (Array.isArray(obj.errors) && obj.errors.length > 0) {
      const first = obj.errors[0];
      if (typeof first === 'string' && first.trim().length > 0) return first;
      if (first && typeof first === 'object') {
        const firstObj = first as Record<string, unknown>;
        if (typeof firstObj.defaultMessage === 'string' && firstObj.defaultMessage.trim().length > 0) {
          return firstObj.defaultMessage;
        }
      }
    }
  }

  if (rawText && !data) {
    return rawText.length > 250 ? `Request failed (${fallbackStatus})` : rawText;
  }

  return `Request failed (${fallbackStatus})`;
}

function extractErrorDetails(data: unknown): string[] {
  if (!data || typeof data !== 'object') return [];

  const obj = data as Record<string, unknown>;
  const details: string[] = [];

  if (typeof obj.message === 'string' && obj.message.trim().length > 0) {
    details.push(obj.message.trim());
  }

  if (typeof obj.error === 'string' && obj.error.trim().length > 0) {
    details.push(obj.error.trim());
  }

  if (Array.isArray(obj.errors)) {
    for (const item of obj.errors) {
      if (typeof item === 'string' && item.trim().length > 0) {
        details.push(item.trim());
        continue;
      }

      if (item && typeof item === 'object') {
        const entry = item as Record<string, unknown>;
        if (typeof entry.defaultMessage === 'string' && entry.defaultMessage.trim().length > 0) {
          details.push(entry.defaultMessage.trim());
        }
      }
    }
  }

  return [...new Set(details)];
}

function throwApiErrorIfNeeded(response: Response, text: string) {
  if (response.ok) return;

  const data = parseJsonSafely(text);
  const message = extractErrorMessage(data, response.status, text);
  const details = extractErrorDetails(data);
  throw new ApiError(response.status, message, message, details);
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

        if (!nextAccessToken) return false;
        setAuthToken(nextAccessToken);
        setRefreshToken(nextRefreshToken);
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
  const headers = new Headers(init.headers ?? {});
  const isFormDataBody = typeof FormData !== 'undefined' && init.body instanceof FormData;

  if (!headers.has('Content-Type') && init.body && !isFormDataBody) {
    headers.set('Content-Type', 'application/json');
  }

  if (!headers.has('Authorization') && token && token !== 'authenticated-session') {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });

  if (response.status === 401 && allowRetry && getRefreshToken()) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return apiFetchRaw(path, init, false);
    }

    redirectToLogin();
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
