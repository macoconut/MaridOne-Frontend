import { apiFetchRaw } from './api';
import { extractFirstId } from './backendTest';

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' ? (value as JsonRecord) : null;
}

function trimmedText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function resolveDepartmentLabel(record: unknown) {
  const source = asRecord(record);
  if (!source) return '';

  return trimmedText(source.department);
}

async function fetchJson(path: string) {
  const response = await apiFetchRaw(path, { method: 'GET' });
  if (!response.ok) return null;

  try {
    return await response.json();
  } catch {
    return null;
  }
}

export function formatEmployeeFullName(record: unknown) {
  const source = asRecord(record);
  if (!source) return '';

  return [source.firstName, source.middleName, source.lastName]
    .map(trimmedText)
    .filter(Boolean)
    .join(' ');
}

export async function resolveHeaderTitle(
  username: string | null | undefined,
  roleLabel: string
): Promise<string> {
  if (!username) return roleLabel;

  const userDetails = await fetchJson(`/api/user/details/${encodeURIComponent(username)}`);
  const userRecord = asRecord(userDetails);
  const nestedEmployee = asRecord(userRecord?.employee);

  const employeeId =
    extractFirstId(userRecord, ['employeeId', 'id', 'empId']) ??
    extractFirstId(nestedEmployee, ['employeeId', 'id', 'empId']);

  const userName = formatEmployeeFullName(userRecord) || formatEmployeeFullName(nestedEmployee);
  if (!employeeId) {
    return userName || username || roleLabel;
  }

  const employeeDetails = await fetchJson(`/api/employees/${employeeId}`);
  const fullName = formatEmployeeFullName(employeeDetails);

  return fullName || userName || username || `${roleLabel}#${employeeId}`;
}

export async function resolveHeaderBadge(
  username: string | null | undefined,
  roleLabel: string,
  options?: { includeDepartment?: boolean }
): Promise<string> {
  if (!username) return roleLabel;

  const userDetails = await fetchJson(`/api/user/details/${encodeURIComponent(username)}`);
  const userRecord = asRecord(userDetails);
  const nestedEmployee = asRecord(userRecord?.employee);

  const employeeId =
    extractFirstId(userRecord, ['employeeId', 'id', 'empId']) ??
    extractFirstId(nestedEmployee, ['employeeId', 'id', 'empId']);

  let departmentLabel =
    resolveDepartmentLabel(userRecord) ||
    resolveDepartmentLabel(nestedEmployee);

  if (options?.includeDepartment && !departmentLabel && employeeId) {
    const employeeDetails = await fetchJson(`/api/employees/${employeeId}`);
    departmentLabel = resolveDepartmentLabel(employeeDetails);
  }

  const badgeLabel = employeeId ? `${roleLabel} #${employeeId}` : roleLabel;
  return options?.includeDepartment && departmentLabel
    ? `${badgeLabel} - ${departmentLabel}`
    : badgeLabel;
}

export async function resolveHeaderBadgeParts(
  username: string | null | undefined,
  roleLabel: string
): Promise<{ badgeLabel: string; departmentLabel: string }> {
  if (!username) {
    return { badgeLabel: roleLabel, departmentLabel: '' };
  }

  const userDetails = await fetchJson(`/api/user/details/${encodeURIComponent(username)}`);
  const userRecord = asRecord(userDetails);
  const nestedEmployee = asRecord(userRecord?.employee);

  const employeeId =
    extractFirstId(userRecord, ['employeeId', 'id', 'empId']) ??
    extractFirstId(nestedEmployee, ['employeeId', 'id', 'empId']);

  let departmentLabel =
    resolveDepartmentLabel(userRecord) ||
    resolveDepartmentLabel(nestedEmployee);

  if (!departmentLabel && employeeId) {
    const employeeDetails = await fetchJson(`/api/employees/${employeeId}`);
    departmentLabel = resolveDepartmentLabel(employeeDetails);
  }

  return {
    badgeLabel: employeeId ? `${roleLabel} #${employeeId}` : roleLabel,
    departmentLabel,
  };
}
