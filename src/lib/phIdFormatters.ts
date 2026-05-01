function onlyDigits(v: string, max: number): string {
  return v.replace(/\D/g, '').slice(0, max);
}

export function formatSss(v = ''): string {
  const d = onlyDigits(v, 10);
  if (d.length <= 2) return d;
  if (d.length <= 9) return `${d.slice(0, 2)}-${d.slice(2)}`;
  return `${d.slice(0, 2)}-${d.slice(2, 9)}-${d.slice(9)}`;
}

export function formatPhilHealth(v = ''): string {
  const d = onlyDigits(v, 12);
  if (d.length <= 2) return d;
  if (d.length <= 11) return `${d.slice(0, 2)}-${d.slice(2)}`;
  return `${d.slice(0, 2)}-${d.slice(2, 11)}-${d.slice(11)}`;
}

export function formatPagibig(v = ''): string {
  const d = onlyDigits(v, 12);
  if (d.length <= 4) return d;
  if (d.length <= 8) return `${d.slice(0, 4)}-${d.slice(4)}`;
  return `${d.slice(0, 4)}-${d.slice(4, 8)}-${d.slice(8)}`;
}

export function formatTin(v = ''): string {
  const d = onlyDigits(v, 12);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6, 9)}-${d.slice(9)}`;
}

export function formatPhone(v = ''): string {
  return onlyDigits(v, 11);
}

export function formatBankAccount(v = ''): string {
  return onlyDigits(v, 15);
}
