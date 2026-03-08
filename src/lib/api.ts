import {
  clearSession,
  getAuthToken,
  getRefreshToken,
  setAuthToken,
  setRefreshToken,
} from './session';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080';
let refreshPromise: Promise<boolean> | null = null;

export function getApiBaseUrl() {
  return API_BASE_URL;
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

  if (!headers.has('Content-Type') && init.body) {
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
  const data = parseJsonSafely(text);

  if (!response.ok) {
    const message =
      data && typeof data === 'object' && typeof (data as Record<string, unknown>).message === 'string'
        ? String((data as Record<string, unknown>).message)
        : `Request failed (${response.status})`;
    throw new Error(message);
  }

  return data as T;
}

export function toArray<T>(input: unknown): T[] {
  if (Array.isArray(input)) return input as T[];
  if (input && typeof input === 'object') {
    const content = (input as Record<string, unknown>).content;
    if (Array.isArray(content)) return content as T[];
  }
  return [];
}
