import { LEAVE_ENDPOINTS } from './leave-endpoints';
import { apiFetchJson} from '../../api';
import { buildUrl } from '@/lib/api/utils/build-url';
import type { Page, PageableParams } from '@/lib/api/types/pagination';

// ==========================================
// DTOs & Interfaces
// ==========================================


export interface BalanceResponseDto {}
export interface BalanceRequestDto {}
export interface UpdateBalanceDto {
  balanceHours?: number;
  leaveType?: string;
  type?: string;
}
export interface LeaveFilter {}
export interface LeaveResponseDto {}
export interface LeaveDetails {}
export interface LeaveBalance {}
export interface LeaveRequestDto {}
export interface LeaveRequest {}


export async function getLeaveBalance(empId: number): Promise<BalanceResponseDto[]> {
  return apiFetchJson<BalanceResponseDto[]>(LEAVE_ENDPOINTS.getBalance(empId));
}

export async function createLeaveBalance(
  empId: number,
  payload: BalanceRequestDto
): Promise<LeaveBalance> {
  return apiFetchJson<LeaveBalance>(LEAVE_ENDPOINTS.createBalance(empId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function updateLeaveBalance(
  empId: number,
  payload: UpdateBalanceDto
): Promise<void> {
  return apiFetchJson<void>(LEAVE_ENDPOINTS.updateBalance(empId), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}



export async function getLeaveRequests(
  filter?: LeaveFilter,
  pageable?: PageableParams
): Promise<Page<LeaveResponseDto>> {
  const url = buildUrl(LEAVE_ENDPOINTS.listRequests, { ...filter, ...pageable });
  return apiFetchJson<Page<LeaveResponseDto>>(url);
}

export async function getTeamLeaveRequests(
  filter?: LeaveFilter,
  pageable?: PageableParams
): Promise<Page<LeaveResponseDto>> {
  const url = buildUrl(LEAVE_ENDPOINTS.listTeamRequests, { ...filter, ...pageable });
  return apiFetchJson<Page<LeaveResponseDto>>(url);
}

export async function getMyLeaveRequests(
  empId: number,
  pageable?: PageableParams
): Promise<Page<LeaveResponseDto>> {
  const url = buildUrl(LEAVE_ENDPOINTS.getMyRequests(empId), { ...pageable });
  return apiFetchJson<Page<LeaveResponseDto>>(url);
}

export async function getLeaveRequestDetails(requestId: number): Promise<LeaveDetails> {
  return apiFetchJson<LeaveDetails>(LEAVE_ENDPOINTS.getRequestDetails(requestId));
}

export async function cancelLeaveRequest(requestId: number): Promise<void> {
  return apiFetchJson<void>(LEAVE_ENDPOINTS.cancelRequest(requestId), {
    method: 'PATCH',
  });
}

export async function createLeaveRequest(
  empId: number,
  payload: LeaveRequestDto,
  files?: File[]
): Promise<LeaveRequest[]> {
  const url = LEAVE_ENDPOINTS.createRequest(empId);

  if (!files || files.length === 0) {
    return apiFetchJson<LeaveRequest[]>(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  const formData = new FormData();
  formData.append('payload', new Blob([JSON.stringify(payload)], { type: 'application/json' }));
  files.forEach(file => formData.append('files', file));

  return apiFetchJson<LeaveRequest[]>(url, {
    method: 'POST',
    body: formData,
  });
}

export async function updateLeaveRequest(
  requestId: number,
  payload: LeaveRequestDto
): Promise<LeaveRequest> {
  return apiFetchJson<LeaveRequest>(LEAVE_ENDPOINTS.updateRequest(requestId), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}