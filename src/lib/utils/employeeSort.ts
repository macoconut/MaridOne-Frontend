export type EmployeeSortKey = 'id' | 'name';

function toEmployeeIdParts(value: unknown) {
  const text =
    typeof value === 'number'
      ? String(value)
      : typeof value === 'string'
        ? value.trim()
        : '';

  const numeric = Number(text);

  return {
    text,
    numeric: Number.isFinite(numeric) ? numeric : null,
  };
}

export function compareEmployeeIds(leftId: unknown, rightId: unknown) {
  const left = toEmployeeIdParts(leftId);
  const right = toEmployeeIdParts(rightId);

  if (left.numeric !== null && right.numeric !== null && left.numeric !== right.numeric) {
    return left.numeric - right.numeric;
  }

  return left.text.localeCompare(right.text, undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

export function compareEmployeeNames(leftName: string, rightName: string) {
  return leftName.localeCompare(rightName, undefined, {
    sensitivity: 'base',
  });
}

export function compareEmployees(
  sortBy: EmployeeSortKey,
  left: { id?: unknown; name?: string },
  right: { id?: unknown; name?: string }
) {
  const leftName = String(left.name ?? '').trim();
  const rightName = String(right.name ?? '').trim();

  if (sortBy === 'name') {
    const nameDiff = compareEmployeeNames(leftName, rightName);
    if (nameDiff !== 0) return nameDiff;
    return compareEmployeeIds(left.id, right.id);
  }

  const idDiff = compareEmployeeIds(left.id, right.id);
  if (idDiff !== 0) return idDiff;
  return compareEmployeeNames(leftName, rightName);
}

export function getEmployeeSortLabel(sortBy: EmployeeSortKey) {
  return sortBy === 'name' ? 'Name' : 'ID';
}
