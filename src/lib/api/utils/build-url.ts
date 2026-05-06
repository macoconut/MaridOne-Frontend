type QueryValue = string | number | boolean | null | undefined;
type QueryParams = Record<string, QueryValue | QueryValue[]>;

export function buildUrl(
  base: string,
  params?: QueryParams
): string {
  if (!params) return base;

  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return;

    if (Array.isArray(value)) {
      value.forEach(v => searchParams.append(key, String(v)));
    } else {
      searchParams.append(key, String(value));
    }
  });

  const query = searchParams.toString();
  return query ? `${base}?${query}` : base;
}