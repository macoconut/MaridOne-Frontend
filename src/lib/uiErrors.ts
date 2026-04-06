import { ApiError } from './api';

export type ErrorContext =
  | 'attendance'
  | 'leave-request'
  | 'overtime-request'
  | 'profile-update'
  | 'employee-load'
  | 'employee-save'
  | 'employee-terminate'
  | 'approval-decision'
  | 'payroll-run'
  | 'payroll-dispute'
  | 'generic';

function prettify(message: string) {
  return message.replace(/\s+/g, ' ').trim();
}

function appendDetail(base: string, detail?: string) {
  if (!detail) return base;
  const cleaned = prettify(detail);
  if (!cleaned || cleaned.toLowerCase() === base.toLowerCase()) return base;
  return `${base} ${cleaned}`;
}

function fromLeaveMessage(error: ApiError) {
  const message = error.rawMessage.toLowerCase();

  if (message.includes('balance of type')) {
    return 'HR has not assigned this leave balance to your account yet.';
  }
  if (message.includes('overlapping')) {
    return 'This leave request overlaps with another pending or approved request.';
  }
  if (message.includes('at least 7 days before the leave date')) {
    return 'Non-sick leave requests must be filed at least 7 days before the leave date.';
  }
  if (message.includes('no shift schedule')) {
    return 'Your work schedule is not set up yet, so the leave request cannot be processed.';
  }

  return null;
}

function fromOvertimeMessage(error: ApiError) {
  const message = error.rawMessage.toLowerCase();
  if (message.includes('conflicting schedules')) {
    return 'This overtime request conflicts with an existing schedule or overtime request.';
  }
  if (message.includes('work schedule is not set up')) {
    return 'Your work schedule is not set up yet, so overtime cannot be filed.';
  }
  if (message.includes('outside your scheduled shift')) {
    return 'Overtime can only be filed outside your scheduled shift hours.';
  }
  if (message.includes('not pending')) {
    return 'This overtime request was already processed and cannot be updated again.';
  }
  return null;
}

export function getFriendlyErrorMessage(error: unknown, context: ErrorContext = 'generic') {
  if (!(error instanceof ApiError)) {
    return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
  }

  if (context === 'leave-request') {
    const specific = fromLeaveMessage(error);
    if (specific) return specific;
  }

  if (context === 'overtime-request') {
    const specific = fromOvertimeMessage(error);
    if (specific) return specific;
  }

  switch (error.status) {
    case 400:
      switch (context) {
        case 'attendance':
          return appendDetail('Attendance could not be recorded. Please check the request and try again.', error.rawMessage);
        case 'leave-request':
          return appendDetail('This leave request could not be submitted.', error.rawMessage);
        case 'overtime-request':
          return appendDetail('This overtime request could not be submitted.', error.rawMessage);
        case 'profile-update':
          return appendDetail('Your profile changes could not be saved.', error.rawMessage);
        case 'employee-save':
          return appendDetail('Employee details could not be saved.', error.rawMessage);
        case 'employee-terminate':
          return appendDetail('This employee could not be terminated yet.', error.rawMessage);
        case 'approval-decision':
          return appendDetail('That approval action could not be completed.', error.rawMessage);
        case 'payroll-run':
          return appendDetail('The payroll run request could not be completed.', error.rawMessage);
        case 'payroll-dispute':
          return appendDetail('The dispute action could not be completed.', error.rawMessage);
        default:
          return appendDetail('The request could not be completed.', error.rawMessage);
      }
    case 401:
      return 'Your session expired. Please sign in again.';
    case 403:
      switch (context) {
        case 'leave-request':
        case 'overtime-request':
        case 'attendance':
          return 'Your account does not currently have permission to perform this action.';
        case 'employee-load':
          return 'This HR view cannot load that data with the current account permissions.';
        default:
          return 'You do not have permission to perform this action.';
      }
    case 404:
      switch (context) {
        case 'leave-request':
          return appendDetail('Required leave setup was not found for this employee.', error.rawMessage);
        case 'employee-load':
          return appendDetail('The requested employee data could not be found.', error.rawMessage);
        case 'payroll-run':
          return appendDetail('The payroll run could not be found.', error.rawMessage);
        default:
          return appendDetail('The requested record could not be found.', error.rawMessage);
      }
    case 409:
      switch (context) {
        case 'leave-request':
          return 'This leave request conflicts with an existing request for the same period.';
        case 'overtime-request':
          return 'This overtime request conflicts with an existing request or schedule.';
        case 'approval-decision':
          return appendDetail('This request was already processed or has a conflicting state.', error.rawMessage);
        default:
          return appendDetail('This action conflicts with existing data.', error.rawMessage);
      }
    case 413:
      switch (context) {
        case 'leave-request':
        case 'overtime-request':
        case 'payroll-dispute':
          return 'Attachment is too large. Files for requests must be 10 MB or smaller.';
        default:
          return 'The uploaded file is too large. Please keep it within 10 MB.';
      }
    case 500:
      return 'The server hit an unexpected problem. Please try again in a moment.';
    default:
      return error.rawMessage || `Request failed (${error.status}).`;
  }
}
