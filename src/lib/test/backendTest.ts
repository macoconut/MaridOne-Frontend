export type PlaceholderContext = Record<string, string | number | null | undefined>;

type ResolvedValue<T> = {
  value: T;
  missing: string[];
};

const PLACEHOLDER_RE = /\{([a-zA-Z0-9_]+)\}/g;

export function extractFirstId(input: unknown, keys: string[]): number | null {
  if (!input || typeof input !== 'object') return null;
  const record = input as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim().length > 0 && !Number.isNaN(Number(value))) {
      return Number(value);
    }
  }
  return null;
}

export function firstFromCollection(input: unknown): unknown {
  if (Array.isArray(input)) return input[0];
  if (!input || typeof input !== 'object') return null;
  const record = input as Record<string, unknown>;
  const content = record.content;
  if (Array.isArray(content)) return content[0];
  const items = record.items;
  if (Array.isArray(items)) return items[0];
  const data = record.data;
  if (Array.isArray(data)) return data[0];
  return null;
}

export function applyPathPlaceholders(path: string, context: PlaceholderContext): ResolvedValue<string> {
  const missing = new Set<string>();
  const value = path.replace(PLACEHOLDER_RE, (_, name: string) => {
    const current = context[name];
    if (current === null || current === undefined || String(current).trim().length === 0) {
      missing.add(name);
      return `{${name}}`;
    }
    return encodeURIComponent(String(current));
  });

  return { value, missing: [...missing] };
}

function resolveValueString(raw: string, context: PlaceholderContext): ResolvedValue<string> {
  const missing = new Set<string>();
  const value = raw.replace(PLACEHOLDER_RE, (_, name: string) => {
    const current = context[name];
    if (current === null || current === undefined || String(current).trim().length === 0) {
      missing.add(name);
      return `{${name}}`;
    }
    return String(current);
  });

  return { value, missing: [...missing] };
}

export function applyBodyPlaceholders(body: unknown, context: PlaceholderContext): ResolvedValue<unknown> {
  if (body === null || body === undefined) return { value: body, missing: [] };
  if (typeof body === 'string') return resolveValueString(body, context);
  if (Array.isArray(body)) {
    const next: unknown[] = [];
    const missing = new Set<string>();
    for (const entry of body) {
      const resolved = applyBodyPlaceholders(entry, context);
      next.push(resolved.value);
      resolved.missing.forEach((m) => missing.add(m));
    }
    return { value: next, missing: [...missing] };
  }
  if (typeof body === 'object') {
    const next: Record<string, unknown> = {};
    const missing = new Set<string>();
    for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
      const resolved = applyBodyPlaceholders(value, context);
      next[key] = resolved.value;
      resolved.missing.forEach((m) => missing.add(m));
    }
    return { value: next, missing: [...missing] };
  }
  return { value: body, missing: [] };
}

