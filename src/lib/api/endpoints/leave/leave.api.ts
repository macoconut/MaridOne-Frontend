import type { LeaveType } from '@/enum/leave-type';
import { Status } from '@/enum/status';
import { LEAVE_ENDPOINTS } from './leave-endpoints';
import { apiFetchJson } from '../../api';
import { buildUrl } from '../../utils/build-url';

export interface LeaveBalanceDto {
    leaveId: number;
    balanceHours: number;
    leaveType: LeaveType;
}

export interface LeaveResponseDto {
  requestId: number;
  empId: number;
  firstName: string;
  lastName: string;
  startDateTime: string;
  endDateTime: string;
  requestStatus: Status;
  reason: string;
  leaveType: LeaveType;
  approver: string;
  approverReason: string;
  approvedAt: string | null;
  paid: boolean;
  suggestedPaid: boolean;
  paidOverrideReason: string;
  managerApprover: string;
  managerApproverReason: string;
  managerApprovedAt: string | null;
}

export interface LeaveFilter {
  requestId?: number;
  startDateTime?: string;
  endDateTime?: string;
  requestStatus?: Status;
  isPaid?: boolean;
}

export async function getLeaveBalance(empId: number): Promise<LeaveBalanceDto[]> {
    const url = LEAVE_ENDPOINTS.getBalance(empId);
    return await apiFetchJson<LeaveBalanceDto[]>(url);
}

export async function getLeaveRequests(leaveFilter: LeaveFilter): Promise<LeaveResponseDto[]> {
    const url = LEAVE_ENDPOINTS.listRequests;
    return await apiFetchJson<LeaveResponseDto[]>(
        buildUrl(url, leaveFilter as Record<string, string | number | boolean>)
    );
}