const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080';

type RequestMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

type ApiRequestOptions = {
  method?: RequestMethod;
  body?: unknown;
};

export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

function parseJsonMaybe(raw: string): unknown {
  if (!raw.trim()) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const raw = await response.text();
  const payload = parseJsonMaybe(raw);

  if (!response.ok) {
    throw new ApiError(`Request failed: ${response.status} ${response.statusText}`, response.status, payload);
  }

  return payload as T;
}

export function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const listLikeKeys = ['content', 'items', 'data', 'rows', 'results'];
    for (const key of listLikeKeys) {
      if (Array.isArray(obj[key])) return obj[key] as T[];
    }
  }
  return [];
}

export { API_BASE_URL };
