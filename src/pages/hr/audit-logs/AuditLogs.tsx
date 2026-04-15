import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { FiFilter, FiSearch, FiXCircle } from 'react-icons/fi';
import ModalCloseButton from '../../../components/dialog/ModalCloseButton';
import PageHeader from '../../../components/layout/PageHeader';
import { useAutoRefreshingPage } from '../../../hooks/useAutoRefreshingPage';
import { useEscapeDismiss } from '../../../hooks/useEscapeDismiss';
import { useErrorDialogEffect } from '../../../hooks/useErrorDialogEffect';
import { apiFetchJson, toArray } from '../../../lib/api';
import { getFriendlyErrorMessage } from '../../../lib/uiErrors';
import './AuditLogs.css';

type ActivityLogRow = {
  activityId?: number;
  username?: string;
  activityType?: string;
  message?: string;
  detailPayload?: string;
  timestamp?: string;
};

type ActivityPage = {
  content?: ActivityLogRow[];
  totalPages?: number;
  last?: boolean;
  page?: {
    size?: number;
    number?: number;
    totalElements?: number;
    totalPages?: number;
  };
};

type PayrollRunRow = {
  payId?: number;
  periodStart?: string;
  periodEnd?: string;
  periodDescription?: string;
  runType?: string;
};

type EmployeeDirectoryRow = {
  employeeId?: number;
  id?: number;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  username?: string;
  userName?: string;
  userAccountName?: string;
  userAccount?: {
    username?: string;
  };
};

type EmployeeDirectory = {
  byUsername: Map<string, string>;
  byEmployeeId: Map<string, string>;
};

type ChangeType = 'CREATE' | 'MODIFY' | 'DELETE';
type TypeFilter = 'all' | ChangeType;
type TimeFilter = 'all' | 'today' | '7d' | '30d';

type AuditEntry = {
  id: string;
  actorName: string;
  actorUsername: string;
  actorSubtitle: string | null;
  activityType: ChangeType;
  activityLabel: string;
  tone: 'create' | 'modify' | 'delete';
  title: string;
  detail: string;
  area: string;
  recordedAt: string;
  timestampValue: number;
  searchIndex: string;
  endpoint: string;
  rawMessage: string;
  detailPayload: string | null;
};

type AuditBreakdownItem = {
  label: string;
  value: string;
  emphasis?: boolean;
};

const SERVER_PAGE_SIZE = 200;
const MAX_SERVER_PAGES = 100;
const CHANGE_TYPES: ChangeType[] = ['CREATE', 'MODIFY', 'DELETE'];

const endpointDescriptions: Array<{
  pattern: RegExp;
  subject: string;
  area: string;
}> = [
  { pattern: /^\/api\/employees\/create\b/i, subject: 'employee profile', area: 'People' },
  { pattern: /^\/api\/employees\/status\//i, subject: 'employee status', area: 'People' },
  { pattern: /^\/api\/employees\b/i, subject: 'employee records', area: 'People' },
  { pattern: /^\/api\/user\/create\b/i, subject: 'user account', area: 'Access' },
  { pattern: /^\/api\/leave\/balance\/update\//i, subject: 'leave balance', area: 'Leave' },
  { pattern: /^\/api\/leave\/balance\//i, subject: 'leave balance', area: 'Leave' },
  { pattern: /^\/api\/leave\/create\//i, subject: 'leave request', area: 'Leave' },
  { pattern: /^\/api\/leave\/update\//i, subject: 'leave request', area: 'Leave' },
  { pattern: /^\/api\/leave\/request\/cancel\//i, subject: 'leave request', area: 'Leave' },
  { pattern: /^\/api\/leave\b/i, subject: 'leave records', area: 'Leave' },
  { pattern: /^\/api\/overtime\/create\b/i, subject: 'overtime request', area: 'Overtime' },
  { pattern: /^\/api\/overtime\/update\b/i, subject: 'overtime request', area: 'Overtime' },
  { pattern: /^\/api\/overtime\/cancel\//i, subject: 'overtime request', area: 'Overtime' },
  { pattern: /^\/api\/overtime\b/i, subject: 'overtime records', area: 'Overtime' },
  { pattern: /^\/api\/employee\/schedule\b/i, subject: 'shift schedule', area: 'Schedule' },
  { pattern: /^\/api\/calendar\/events\b/i, subject: 'calendar event', area: 'Calendar' },
  { pattern: /^\/api\/calendar\b/i, subject: 'calendar records', area: 'Calendar' },
  { pattern: /^\/api\/payroll\/run\/process\b/i, subject: 'payroll run', area: 'Payroll' },
  { pattern: /^\/api\/payroll\/run\/create\b/i, subject: 'adjustment payroll run', area: 'Payroll' },
  { pattern: /^\/api\/payroll\/run\/\d+\/items\b/i, subject: 'payroll run items', area: 'Payroll' },
  { pattern: /^\/api\/payroll\/item\/create\b/i, subject: 'payroll item', area: 'Payroll' },
  { pattern: /^\/api\/payroll\/item\/update\//i, subject: 'payroll item', area: 'Payroll' },
  { pattern: /^\/api\/payroll\/item\/dispute\/create\//i, subject: 'payroll dispute', area: 'Payroll' },
  { pattern: /^\/api\/payroll\/item\/dispute\/update\//i, subject: 'payroll dispute', area: 'Payroll' },
  { pattern: /^\/api\/payroll\/item\/dispute\/cancel\//i, subject: 'payroll dispute', area: 'Payroll' },
  { pattern: /^\/api\/payroll\/item\/dispute\b/i, subject: 'payroll dispute', area: 'Payroll' },
  { pattern: /^\/api\/payroll\b/i, subject: 'payroll data', area: 'Payroll' },
  { pattern: /^\/api\/document/i, subject: 'documents', area: 'Documents' },
];

function normalizeWhitespace(value?: string) {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

function normalizeSearch(value?: string) {
  return normalizeWhitespace(value).toLowerCase();
}

function isChangeType(value?: string): value is ChangeType {
  return CHANGE_TYPES.includes((value ?? '').toUpperCase() as ChangeType);
}

function formatDate(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatDateTime(value?: string) {
  if (!value) return 'Unknown time';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function activityLabel(activityType: ChangeType) {
  if (activityType === 'CREATE') return 'Created';
  if (activityType === 'MODIFY') return 'Updated';
  return 'Deleted';
}

function activityTone(activityType: ChangeType) {
  if (activityType === 'CREATE') return 'create' as const;
  if (activityType === 'MODIFY') return 'modify' as const;
  return 'delete' as const;
}

function extractEndpoint(message: string) {
  const match = message.match(/Endpoint:\s*(\/api\/[^\s|]+)/i);
  return match?.[1]?.replace(/[.,;:]+$/g, '') ?? '';
}

function extractPayrollRunId(endpoint: string) {
  const match = endpoint.match(/^\/api\/payroll\/run\/(?<payId>\d+)\b/i);
  return match?.groups?.payId ?? null;
}

function extractEmployeeIdFromEndpoint(endpoint: string) {
  const match = endpoint.match(
    /^\/api\/(?:employees(?:\/status)?|user|leave\/balance(?:\/update)?)(?:\/(?<employeeId>\d+))\b/i
  );
  return match?.groups?.employeeId ?? null;
}

function describeEndpoint(endpoint: string) {
  for (const item of endpointDescriptions) {
    if (item.pattern.test(endpoint)) return item;
  }

  const cleaned = endpoint.replace(/^\/api\//i, '').split(/[/?]/)[0].replace(/[-_]/g, ' ').trim();
  return {
    subject: cleaned ? cleaned : 'records',
    area: 'General',
  };
}

function parseCorrectionMessage(message: string) {
  const match = message.match(
    /^Payslip correction staged by (?<user>[^:]+): emp #(?<empId>\d+) item #(?<itemId>\d+) (?<label>.+?) line #(?<lineId>\d+) (?<before>[^ ]+)->(?<after>[^ ]+) in adj run #(?<runId>\d+)$/i
  );

  if (!match?.groups) return null;

  return {
    employeeId: match.groups.empId,
    itemId: match.groups.itemId,
    label: normalizeWhitespace(match.groups.label),
    lineId: match.groups.lineId,
    before: match.groups.before,
    after: match.groups.after,
    runId: match.groups.runId,
  };
}

function buildEmployeeName(row: EmployeeDirectoryRow) {
  const fullName = [row.firstName, row.middleName, row.lastName]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .join(' ')
    .trim();

  return fullName || null;
}

function possibleUsernames(row: EmployeeDirectoryRow) {
  return [
    row.userAccountName,
    row.username,
    row.userName,
    row.userAccount?.username,
  ]
    .map((value) => normalizeSearch(value))
    .filter(Boolean);
}

function buildDirectory(rows: EmployeeDirectoryRow[]) {
  const byUsername = new Map<string, string>();
  const byEmployeeId = new Map<string, string>();

  for (const row of rows) {
    const name = buildEmployeeName(row);
    if (!name) continue;

    const employeeId = row.employeeId ?? row.id;
    if (employeeId !== null && employeeId !== undefined) {
      const key = String(employeeId);
      if (!byEmployeeId.has(key)) {
        byEmployeeId.set(key, name);
      }
    }

    for (const username of possibleUsernames(row)) {
      if (!byUsername.has(username)) {
        byUsername.set(username, name);
      }
    }
  }

  return {
    byUsername,
    byEmployeeId,
  };
}

function actorPresentation(username: string | undefined, directory: EmployeeDirectory) {
  const cleanedUsername = normalizeWhitespace(username);
  const normalizedUsername = normalizeSearch(cleanedUsername);
  const fullName = normalizedUsername ? directory.byUsername.get(normalizedUsername) : undefined;

  if (fullName) {
    return {
      actorName: fullName,
      actorUsername: cleanedUsername || fullName,
      actorSubtitle:
        cleanedUsername && normalizeSearch(fullName) !== normalizedUsername ? `@${cleanedUsername}` : null,
    };
  }

  return {
    actorName: cleanedUsername || 'Unknown user',
    actorUsername: cleanedUsername || 'Unknown user',
    actorSubtitle: null,
  };
}

function cleanDetailMessage(message: string) {
  const withoutMeta = message
    .replace(/^Username:\s*.*?(?:\s*\|\s*|\.(?:\s+|$)|$)/i, '')
    .replace(/^Activity:\s*.*?(?:\s*\|\s*|\.(?:\s+|$)|$)/i, '')
    .replace(/^Endpoint:\s*\/api\/[^\s|]+(?:\s*\|\s*|\.(?:\s+|$)|$)/i, '')
    .trim();

  const normalized = normalizeWhitespace(withoutMeta)
    .replace(/\s*\|\s*/g, '. ')
    .replace(/Target employee:/gi, 'Employee:')
    .replace(/Target leave request:/gi, 'Leave request:')
    .replace(/Target overtime request:/gi, 'Overtime request:')
    .replace(/Target dispute request:/gi, 'Dispute request:')
    .replace(/\.\.+/g, '.');

  return normalized || null;
}

function parseBreakdownItems(detailPayload?: string | null) {
  const lines = String(detailPayload ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return lines
    .map((line) => {
      const separatorIndex = line.indexOf(':');
      if (separatorIndex <= 0) return null;

      const label = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim();
      if (!label || !value) return null;

      return {
        label,
        value,
        emphasis: /^(Employee|Current Status|Change|Release Reason|Eligible For Rehire|Effective Date|Summary)$/i.test(label),
      } satisfies AuditBreakdownItem;
    })
    .filter(Boolean) as AuditBreakdownItem[];
}

function buildPayrollRunMap(rows: PayrollRunRow[]) {
  const byId = new Map<string, PayrollRunRow>();

  for (const row of rows) {
    if (row.payId === null || row.payId === undefined) continue;
    byId.set(String(row.payId), row);
  }

  return byId;
}

function resolveEmployeeName(employeeId: string, directory: EmployeeDirectory) {
  return directory.byEmployeeId.get(employeeId) ?? `Employee #${employeeId}`;
}

function formatPayrollPeriod(periodStart?: string, periodEnd?: string) {
  const start = formatDate(periodStart);
  const end = formatDate(periodEnd);
  if (start && end) return `${start} to ${end}`;
  return start || end || 'an unavailable payroll period';
}

function describePayrollRun(run?: PayrollRunRow | null, fallbackId?: string) {
  const runTypeLabel = run?.runType === 'ADJUSTMENT' ? 'adjustment payroll' : 'payroll run';

  if (!run) {
    return fallbackId ? `${runTypeLabel} #${fallbackId}` : runTypeLabel;
  }

  const period = formatPayrollPeriod(run.periodStart, run.periodEnd);
  return `${runTypeLabel} for ${period}`;
}

function formatAmount(value: string) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  return numeric.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function buildSimpleActionDetail(activityType: ChangeType, subject: string) {
  if (activityType === 'CREATE') return `Created ${subject}.`;
  if (activityType === 'MODIFY') return `Updated ${subject}.`;
  return `Deleted ${subject}.`;
}

function extractLabeledValue(detail: string | null, label: string) {
  if (!detail) return null;

  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = detail.match(new RegExp(`${escapedLabel}:\\s*(.+?)(?:\\.\\s*|$)`, 'i'));
  return match?.[1]?.trim() ?? null;
}

function buildEmployeeRecordDetail(action: string, cleanedNote: string | null, fallbackName?: string | null) {
  if (cleanedNote) {
    const recordReference = cleanedNote.match(/^Employee record for\s+(.+?)\.?$/i)?.[1]?.trim();
    if (recordReference) {
      return `${action} the employee record for ${recordReference}.`;
    }
  }

  const employeeReference = extractLabeledValue(cleanedNote, 'Employee');
  if (employeeReference) {
    return `${action} the employee record for ${employeeReference}.`;
  }
  if (fallbackName) {
    return `${action} ${fallbackName}.`;
  }
  return `${action} an employee record.`;
}

function buildUserAccountDetail(action: string, cleanedNote: string | null, fallbackName?: string | null) {
  if (cleanedNote) {
    if (/^User account\b/i.test(cleanedNote)) {
      return cleanedNote;
    }

    const employeeReference = extractLabeledValue(cleanedNote, 'Employee');
    if (employeeReference) {
      return `${action} the user account for ${employeeReference}.`;
    }
  }

  if (fallbackName) {
    return `${action} the user account for ${fallbackName}.`;
  }

  return `${action} a user account.`;
}

function buildLeaveBalanceDetail(
  action: 'create' | 'modify',
  employeeName: string,
  cleanedNote: string | null
) {
  const leaveType = extractLabeledValue(cleanedNote, 'Leave type');
  const baseDetail =
    action === 'create'
      ? `Added a leave balance for ${employeeName}`
      : `Updated leave balances for ${employeeName}`;

  return leaveType ? `${baseDetail} under ${leaveType}.` : `${baseDetail}.`;
}

function buildFriendlyCopy(
  row: ActivityLogRow,
  activityType: ChangeType,
  directory: EmployeeDirectory,
  payrollRunsById: Map<string, PayrollRunRow>
) {
  const message = normalizeWhitespace(row.message);
  const detailPayload = normalizeWhitespace(row.detailPayload);
  const endpoint = extractEndpoint(message);
  const endpointMeta = endpoint ? describeEndpoint(endpoint) : { subject: 'records', area: 'General' };
  const correctionMeta = parseCorrectionMessage(message);
  const action = activityLabel(activityType);

  if (correctionMeta) {
    const employeeName = resolveEmployeeName(correctionMeta.employeeId, directory);
    const payrollRunLabel = describePayrollRun(payrollRunsById.get(correctionMeta.runId), correctionMeta.runId);

    return {
      title: 'Staged payslip correction',
      detail: `Adjusted ${correctionMeta.label} from ${formatAmount(correctionMeta.before)} to ${formatAmount(correctionMeta.after)} for ${employeeName} during ${payrollRunLabel}.`,
      area: 'Payroll',
    };
  }

  const cleanedNote = cleanDetailMessage(message);

  if (endpoint) {
    const payrollRunId = extractPayrollRunId(endpoint);
    const payrollRunLabel = payrollRunId ? describePayrollRun(payrollRunsById.get(payrollRunId), payrollRunId) : null;

    if (/^\/api\/employees\/create\b/i.test(endpoint)) {
      return {
        title: 'Created employee record',
        detail: buildEmployeeRecordDetail(action, cleanedNote),
        area: 'People',
      };
    }

    if (/^\/api\/calendar\/events\/create\b/i.test(endpoint)) {
      return {
        title: 'Created calendar event',
        detail: cleanedNote || 'Created a calendar event.',
        area: 'Calendar',
      };
    }

    if (/^\/api\/calendar\/events\/update\b/i.test(endpoint)) {
      return {
        title: 'Updated calendar event',
        detail: cleanedNote || 'Updated a calendar event.',
        area: 'Calendar',
      };
    }

    if (/^\/api\/calendar\/events\/delete\/\d+\b/i.test(endpoint)) {
      return {
        title: 'Deleted calendar event',
        detail: cleanedNote || 'Deleted a calendar event.',
        area: 'Calendar',
      };
    }

    if (/^\/api\/payroll\/run\/\d+\/adjustment\/correction\b/i.test(endpoint)) {
      return {
        title: 'Staged payslip correction',
        detail: payrollRunLabel
          ? `Prepared a payslip correction for ${payrollRunLabel}.`
          : 'Prepared a payslip correction.',
        area: 'Payroll',
      };
    }

    if (/^\/api\/payroll\/run\/\d+\/post\b/i.test(endpoint)) {
      return {
        title: 'Posted payroll run',
        detail: payrollRunLabel ? `Posted ${payrollRunLabel}.` : 'Posted a payroll run.',
        area: 'Payroll',
      };
    }

    if (/^\/api\/payroll\/run\/process\b/i.test(endpoint)) {
      return {
        title: 'Processed payroll run',
        detail: cleanedNote || 'Processed a payroll run.',
        area: 'Payroll',
      };
    }

    if (/^\/api\/payroll\/run\/create\b/i.test(endpoint)) {
      return {
        title: 'Created adjustment payroll',
        detail: cleanedNote || 'Created an adjustment payroll run.',
        area: 'Payroll',
      };
    }

    if (/^\/api\/payroll\/item\/create\b/i.test(endpoint)) {
      return {
        title: 'Created payroll item',
        detail: cleanedNote || 'Added a payroll item.',
        area: 'Payroll',
      };
    }

    if (/^\/api\/payroll\/item\/update\/\d+\b/i.test(endpoint)) {
      return {
        title: 'Updated payroll item',
        detail: cleanedNote || 'Updated a payroll item.',
        area: 'Payroll',
      };
    }

    if (/^\/api\/overtime\/create\b/i.test(endpoint)) {
      return {
        title: 'Submitted overtime request',
        detail: cleanedNote || 'Submitted an overtime request.',
        area: 'Overtime',
      };
    }

    if (/^\/api\/overtime\/update\b/i.test(endpoint)) {
      return {
        title: 'Updated overtime request',
        detail: cleanedNote || 'Updated an overtime request.',
        area: 'Overtime',
      };
    }

    if (/^\/api\/overtime\/cancel\/\d+\b/i.test(endpoint)) {
      return {
        title: 'Cancelled overtime request',
        detail: cleanedNote || 'Cancelled an overtime request.',
        area: 'Overtime',
      };
    }

    if (/^\/api\/leave\/create\/\d+\b/i.test(endpoint)) {
      return {
        title: 'Submitted leave request',
        detail: cleanedNote || 'Submitted a leave request.',
        area: 'Leave',
      };
    }

    if (/^\/api\/leave\/update\/\d+\b/i.test(endpoint)) {
      return {
        title: 'Updated leave request',
        detail: cleanedNote || 'Updated a leave request.',
        area: 'Leave',
      };
    }

    if (/^\/api\/leave\/request\/cancel\/\d+\b/i.test(endpoint)) {
      return {
        title: 'Cancelled leave request',
        detail: cleanedNote || 'Cancelled a leave request.',
        area: 'Leave',
      };
    }

    if (/^\/api\/payroll\/item\/dispute\/create\/\d+\b/i.test(endpoint)) {
      return {
        title: 'Submitted payroll dispute',
        detail: cleanedNote || 'Submitted a payroll dispute.',
        area: 'Payroll',
      };
    }

    if (/^\/api\/payroll\/item\/dispute\/update\/\d+\b/i.test(endpoint)) {
      return {
        title: 'Updated payroll dispute',
        detail: cleanedNote || 'Updated a payroll dispute.',
        area: 'Payroll',
      };
    }

    if (/^\/api\/payroll\/item\/dispute\/cancel\/\d+\b/i.test(endpoint)) {
      return {
        title: 'Cancelled payroll dispute',
        detail: cleanedNote || 'Cancelled a payroll dispute.',
        area: 'Payroll',
      };
    }

    const targetEmployeeId = extractEmployeeIdFromEndpoint(endpoint);
    if (targetEmployeeId) {
      const employeeName = resolveEmployeeName(targetEmployeeId, directory);

      if (/^\/api\/employees\/status\/\d+\b/i.test(endpoint)) {
        const releaseSummary = extractLabeledValue(detailPayload, 'Summary');
        const currentStatus = extractLabeledValue(detailPayload, 'Current Status');
        const releaseReason = extractLabeledValue(detailPayload, 'Release Reason');
        return {
          title: currentStatus === 'Employee Released' ? 'Recorded employee release' : 'Updated employee status',
          detail:
            releaseSummary ||
            (releaseReason
              ? `Recorded ${employeeName} as released under ${releaseReason}.`
              : `Updated employment status for ${employeeName}.`),
          area: 'People',
        };
      }

      if (/^\/api\/user\/\d+\b/i.test(endpoint)) {
        return {
          title: `${action} user account`,
          detail: buildUserAccountDetail(action, cleanedNote, employeeName),
          area: 'Access',
        };
      }

      if (/^\/api\/leave\/balance\/update\/\d+\b/i.test(endpoint)) {
        return {
          title: 'Updated leave balance',
          detail: buildLeaveBalanceDetail('modify', employeeName, cleanedNote),
          area: 'Leave',
        };
      }

      if (/^\/api\/leave\/balance\/\d+\b/i.test(endpoint) && activityType === 'CREATE') {
        return {
          title: 'Added leave balance',
          detail: buildLeaveBalanceDetail('create', employeeName, cleanedNote),
          area: 'Leave',
        };
      }

      if (/^\/api\/employees\/\d+\b/i.test(endpoint)) {
        return {
          title: `${action} employee record`,
          detail: buildEmployeeRecordDetail(action, cleanedNote, employeeName),
          area: 'People',
        };
      }
    }

    if (/^\/api\/user\/create\b/i.test(endpoint)) {
      return {
        title: `${action} user account`,
        detail: buildUserAccountDetail(action, cleanedNote),
        area: 'Access',
      };
    }
  }

  if (cleanedNote) {
    return {
      title: `${action} ${endpointMeta.subject}`,
      detail: cleanedNote,
      area: endpointMeta.area,
    };
  }

  return {
    title: `${action} ${endpointMeta.subject}`,
    detail: buildSimpleActionDetail(activityType, endpointMeta.subject),
    area: endpointMeta.area,
  };
}

function toSearchIndex(parts: Array<string | number | null | undefined>) {
  return parts
    .map((part) => normalizeSearch(part === null || part === undefined ? '' : String(part)))
    .filter(Boolean)
    .join(' ');
}

function toAuditEntry(
  row: ActivityLogRow,
  index: number,
  directory: EmployeeDirectory,
  payrollRunsById: Map<string, PayrollRunRow>
): AuditEntry | null {
  const normalizedType = (row.activityType ?? '').toUpperCase();
  if (!isChangeType(normalizedType)) return null;

  const actor = actorPresentation(row.username, directory);
  const endpoint = extractEndpoint(normalizeWhitespace(row.message));
  const copy = buildFriendlyCopy(row, normalizedType, directory, payrollRunsById);
  const timestampValue = row.timestamp ? Date.parse(row.timestamp) || 0 : 0;

  return {
    id: String(row.activityId ?? `${row.timestamp ?? 'row'}-${index}`),
    actorName: actor.actorName,
    actorUsername: actor.actorUsername,
    actorSubtitle: actor.actorSubtitle,
    activityType: normalizedType,
    activityLabel: activityLabel(normalizedType),
    tone: activityTone(normalizedType),
    title: copy.title,
    detail: copy.detail,
    area: copy.area,
    recordedAt: formatDateTime(row.timestamp),
    timestampValue,
    endpoint,
    rawMessage: row.message ?? '',
    detailPayload: row.detailPayload ?? null,
    searchIndex: toSearchIndex([
      row.activityId,
      actor.actorName,
      actor.actorUsername,
      copy.title,
      copy.detail,
      copy.area,
      normalizedType,
      row.detailPayload,
    ]),
  };
}

function matchesTimeWindow(timestampValue: number, filter: TimeFilter) {
  if (filter === 'all') return true;
  if (!timestampValue) return false;

  const now = new Date();
  const rowDate = new Date(timestampValue);

  if (filter === 'today') {
    return (
      rowDate.getFullYear() === now.getFullYear() &&
      rowDate.getMonth() === now.getMonth() &&
      rowDate.getDate() === now.getDate()
    );
  }

  const diffMs = Date.now() - timestampValue;
  const limitDays = filter === '7d' ? 7 : 30;
  return diffMs <= limitDays * 24 * 60 * 60 * 1000;
}

async function loadAllActivityRows() {
  const collected = new Map<string, ActivityLogRow>();
  let page = 0;
  let totalPages = 1;

  while (page < totalPages && page < MAX_SERVER_PAGES) {
    const payload = await apiFetchJson<ActivityPage>(`/api/logs/activity?page=${page}&size=${SERVER_PAGE_SIZE}`);
    const content = toArray<ActivityLogRow>(payload);

    for (const row of content) {
      const type = (row.activityType ?? '').toUpperCase();
      if (!isChangeType(type)) continue;

      const key = String(row.activityId ?? `${row.timestamp ?? 'row'}-${collected.size}`);
      if (!collected.has(key)) {
        collected.set(key, { ...row, activityType: type });
      }
    }

    const resolvedTotalPages =
      typeof payload.page?.totalPages === 'number' && payload.page.totalPages > 0
        ? payload.page.totalPages
        : typeof payload.totalPages === 'number' && payload.totalPages > 0
          ? payload.totalPages
          : page + 1;
    totalPages = Math.max(resolvedTotalPages, page + 1);

    const resolvedPageSize =
      typeof payload.page?.size === 'number' && payload.page.size > 0 ? payload.page.size : SERVER_PAGE_SIZE;
    const resolvedPageNumber =
      typeof payload.page?.number === 'number' && payload.page.number >= 0 ? payload.page.number : page;
    const isLast =
      typeof payload.last === 'boolean'
        ? payload.last
        : resolvedPageNumber >= totalPages - 1 || content.length < resolvedPageSize;
    page += 1;
    if (isLast) break;
  }

  return [...collected.values()].sort((left, right) => {
    const leftTime = left.timestamp ? Date.parse(left.timestamp) || 0 : 0;
    const rightTime = right.timestamp ? Date.parse(right.timestamp) || 0 : 0;
    return rightTime - leftTime || Number(right.activityId ?? 0) - Number(left.activityId ?? 0);
  });
}

export default function HrAuditLogs() {
  const [rows, setRows] = useState<ActivityLogRow[]>([]);
  const [directory, setDirectory] = useState<EmployeeDirectory>({ byUsername: new Map(), byEmployeeId: new Map() });
  const [payrollRunsById, setPayrollRunsById] = useState<Map<string, PayrollRunRow>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [searchValue, setSearchValue] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [refreshTick, setRefreshTick] = useState(0);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const silentRefreshRef = useRef(false);

  useErrorDialogEffect(loadError, 'Audit logs could not be loaded');
  const handlePageRefresh = () => {
    silentRefreshRef.current = true;
    setRefreshTick((tick) => tick + 1);
  };
  useAutoRefreshingPage(handlePageRefresh, { intervalMs: 15000 });
  useEscapeDismiss(Boolean(selectedEntryId), () => setSelectedEntryId(null), 10);

  useEffect(() => {
    if (selectedEntryId) document.body.classList.add('modal-open');
    else document.body.classList.remove('modal-open');

    return () => document.body.classList.remove('modal-open');
  }, [selectedEntryId]);

  const deferredSearch = useDeferredValue(normalizeSearch(searchValue));

  useEffect(() => {
    let cancelled = false;

    async function loadLogs() {
      const isSilentRefresh = silentRefreshRef.current;
      try {
        if (!isSilentRefresh) {
          setIsLoading(true);
          setLoadError('');
        }

        const [activityRows, employeePayload, payrollRunsPayload] = await Promise.all([
          loadAllActivityRows(),
          apiFetchJson<unknown>('/api/employees?page=0&size=500').catch(() => null),
          apiFetchJson<unknown>('/api/payroll/run').catch(() => null),
        ]);

        if (cancelled) return;

        setRows(activityRows);
        setDirectory(
          employeePayload
            ? buildDirectory(toArray<EmployeeDirectoryRow>(employeePayload))
            : { byUsername: new Map(), byEmployeeId: new Map() }
        );
        setPayrollRunsById(
          payrollRunsPayload ? buildPayrollRunMap(toArray<PayrollRunRow>(payrollRunsPayload)) : new Map()
        );
        setLoadError('');
      } catch (error) {
        if (cancelled) return;
        if (!isSilentRefresh) {
          setRows([]);
          setDirectory({ byUsername: new Map(), byEmployeeId: new Map() });
          setPayrollRunsById(new Map());
          setLoadError(getFriendlyErrorMessage(error));
        }
      } finally {
        if (!cancelled) {
          if (!isSilentRefresh) setIsLoading(false);
          silentRefreshRef.current = false;
        }
      }
    }

    void loadLogs();
    return () => {
      cancelled = true;
    };
  }, [refreshTick]);

  const entries = useMemo(
    () =>
      rows
        .map((row, index) => toAuditEntry(row, index, directory, payrollRunsById))
        .filter((entry): entry is AuditEntry => entry !== null),
    [directory, payrollRunsById, rows]
  );

  const visibleEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (typeFilter !== 'all' && entry.activityType !== typeFilter) return false;
      if (!matchesTimeWindow(entry.timestampValue, timeFilter)) return false;
      if (deferredSearch && !entry.searchIndex.includes(deferredSearch)) return false;
      return true;
    });
  }, [deferredSearch, entries, timeFilter, typeFilter]);

  const activeFilterCount = [typeFilter, timeFilter].filter((value) => value !== 'all').length;
  const selectedEntry = useMemo(
    () => visibleEntries.find((entry) => entry.id === selectedEntryId) ?? null,
    [selectedEntryId, visibleEntries]
  );
  const selectedBreakdownItems = useMemo(
    () => parseBreakdownItems(selectedEntry?.detailPayload),
    [selectedEntry?.detailPayload]
  );

  function clearFilters() {
    setTypeFilter('all');
    setTimeFilter('all');
  }

  return (
    <div className="hrAudit">
      <div className="hrAudit__head">
        <PageHeader
          title="Audit Logs"
          description="Review create, update, and delete activity across the HR system."
        />
      </div>

      <section className="hrAuditTable">
        <div className="hrAuditToolbar">
          <label className="uSearch" aria-label="Search audit logs">
            <FiSearch />
            <input
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Search name, action, area, or details"
            />
            {searchValue && (
              <button type="button" aria-label="Clear search" onClick={() => setSearchValue('')}>
                <FiXCircle />
              </button>
            )}
          </label>

          <div className="uFilter">
            <button
              type="button"
              className={`uFilter__toggle ${filterOpen ? 'is-open' : ''} ${activeFilterCount > 0 ? 'is-active' : ''}`}
              onClick={() => setFilterOpen((open) => !open)}
            >
              <FiFilter />
              <span>Filter</span>
            </button>

            {filterOpen && (
              <div className="uFilter__panel">
                <label className="uFilter__field">
                  <span>Log Type</span>
                  <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as TypeFilter)}>
                    <option value="all">All Changes</option>
                    <option value="CREATE">Created</option>
                    <option value="MODIFY">Updated</option>
                    <option value="DELETE">Deleted</option>
                  </select>
                </label>

                <label className="uFilter__field">
                  <span>Time Window</span>
                  <select value={timeFilter} onChange={(event) => setTimeFilter(event.target.value as TimeFilter)}>
                    <option value="all">All Time</option>
                    <option value="today">Today</option>
                    <option value="7d">Last 7 Days</option>
                    <option value="30d">Last 30 Days</option>
                  </select>
                </label>

                <div className="uFilter__actions">
                  <button type="button" onClick={clearFilters}>
                    Clear Filters
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="hrAuditTable__body">
          {isLoading ? (
            <div className="hrAuditRow">
              <span className="hrAuditRow__actor">
                <span className="hrAuditRow__actorName">Loading logs...</span>
              </span>
              <span className="hrAuditRow__message">
                <span className="hrAuditRow__title">Fetching create, update, and delete activity.</span>
                <span className="hrAuditRow__detail">Please wait a moment.</span>
              </span>
              <span className="hrAuditRow__meta">
                <span className="hrAuditRow__time">-</span>
              </span>
            </div>
          ) : visibleEntries.length > 0 ? (
            visibleEntries.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className="hrAuditRow"
                onClick={() => setSelectedEntryId(entry.id)}
              >
                <span className="hrAuditRow__actor">
                  <span className="hrAuditRow__actorName">{entry.actorName}</span>
                  {entry.actorSubtitle && <span className="hrAuditRow__actorSub">{entry.actorSubtitle}</span>}
                </span>

                <span className="hrAuditRow__message">
                  <span className="hrAuditRow__title">{entry.title}</span>
                  <span className="hrAuditRow__detail">{entry.detail}</span>
                </span>

                <span className="hrAuditRow__meta">
                  <span className="hrAuditRow__tagGroup">
                    <span className={`hrAuditRow__badge hrAuditRow__badge--${entry.tone}`}>
                      {entry.activityLabel}
                    </span>
                    <span className="hrAuditRow__area">{entry.area}</span>
                  </span>
                  <span className="hrAuditRow__time">{entry.recordedAt}</span>
                </span>
              </button>
            ))
          ) : (
            <div className="uEmptyState">
              No audit logs matched your current search or filters. Try adjusting them to see more activity.
            </div>
          )}
        </div>
      </section>

      {selectedEntry ? (
        <div className="hrAuditModalBackdrop" role="dialog" aria-modal="true" onClick={() => setSelectedEntryId(null)}>
          <div className="hrAuditModal" onClick={(event) => event.stopPropagation()}>
            <div className="hrAuditModal__header">
              <div className="hrAuditModal__intro">
                <h2>{selectedEntry.title}</h2>
                <p>{selectedEntry.detail}</p>
              </div>
              <ModalCloseButton onClick={() => setSelectedEntryId(null)} aria-label="Close audit log details" />
            </div>

            <div className="hrAuditModal__meta">
              <span className={`hrAuditRow__badge hrAuditRow__badge--${selectedEntry.tone}`}>
                {selectedEntry.activityLabel}
              </span>
              <span className="hrAuditRow__area">{selectedEntry.area}</span>
              <span className="hrAuditModal__time">{selectedEntry.recordedAt}</span>
            </div>

            <div className="hrAuditModal__rule" />

            {selectedBreakdownItems.length > 0 ? (
              <div className="hrAuditModal__grid">
                {selectedBreakdownItems.map((item) => (
                  <article
                    key={`${selectedEntry.id}-${item.label}`}
                    className={`hrAuditModal__card ${item.emphasis ? 'is-emphasis' : ''}`}
                  >
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </article>
                ))}
              </div>
            ) : (
              <div className="hrAuditModal__empty">No detailed audit breakdown is available for this entry yet.</div>
            )}

            <div className="hrAuditModal__rule is-subtle" />

            <div className="hrAuditModal__footer">
              {selectedEntry.endpoint ? (
                <div className="hrAuditModal__footerItem">
                  <span>Endpoint</span>
                  <strong>{selectedEntry.endpoint}</strong>
                </div>
              ) : null}
              <div className="hrAuditModal__footerItem">
                <span>Stored Audit Message</span>
                <strong>{selectedEntry.rawMessage || 'No raw message available.'}</strong>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
