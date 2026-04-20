export type OvertimeApprovalRow = {
  overtimeId?: number
  employeeId?: number
  requestStatus?: string
  requestAt?: string
  workDate?: string
  startTime?: string
  endTime?: string
  approvedAt?: string
  approver?: string
  overtimeType?: string
  reason?: string
  approveReason?: string
  paid?: boolean
  suggestedPaid?: boolean
  paidOverrideReason?: string
  managerApprover?: string
  managerApproveReason?: string
  managerApprovedAt?: string
}

export type LeaveApprovalRow = {
  requestId?: number
  empId?: number
  employeeId?: number
  firstName?: string
  middleName?: string
  lastName?: string
  startDateTime?: string
  endDateTime?: string
  requestAt?: string
  requestStatus?: string
  reason?: string
  leaveType?: string
  approver?: string
  approverReason?: string
  approvedAt?: string
  paid?: boolean
  isPaid?: boolean
  suggestedPaid?: boolean
  paidOverrideReason?: string
  managerApprover?: string
  managerApproverReason?: string
  managerApprovedAt?: string
}

export type ApprovalEmployeeDirectoryRow = {
  employeeId?: number
  id?: number
  firstName?: string
  middleName?: string
  lastName?: string
  username?: string
  userName?: string
  userAccountName?: string
  userAccount?: {
    username?: string
  }
}
