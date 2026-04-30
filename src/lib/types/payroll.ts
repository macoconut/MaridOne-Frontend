export type PayrollRunRow = {
  payId?: number
  payrollRunId?: number
  periodStart?: string
  periodEnd?: string
  paymentDate?: string
  periodDescription?: string
  payrollStatus?: string
  runType?: string
  itemCount?: number
}

export type PayrollItemReference = {
  id?: number
  itemId?: number
  runDetails?: {
    id?: number
    periodStart?: string
    periodEnd?: string
    paymentDate?: string
    payrollStatus?: string
    runType?: string
  }
}

export type PayrollItemRow = PayrollItemReference & {
  empId?: number
  employeeId?: number
  firstName?: string
  lastName?: string
  employeeName?: string
  grossPay?: number | string
  netPay?: number | string
  employerContributionTotal?: number | string
}

export type EmployeeDirectoryEntry = {
  id: number
  role: string
  department: string
}

export type EmployeeReportRow = PayrollItemRow & {
  role: string
  department: string
}

export type AdjustmentKind = 'EARNING' | 'DEDUCTION'
export type SummaryKind = AdjustmentKind | 'EMPLOYER_CONTRIBUTION'

export type PayrollBreakdownLine = {
  key: string
  lineId: number
  lineType: SummaryKind
  label: string
  amount: string
  originalAmount?: string
  adjustedBy?: string
  adjustedAt?: string
}

export type PayTypeSummaryRow = {
  payType?: string
  adjustment?: AdjustmentKind
  adjustmentKind?: AdjustmentKind
  summaryKind?: SummaryKind
  total?: number | string
}

export type PayrollDisputeRow = {
  id?: number
  disputeId?: number
  payrollItemId?: number
  itemId?: number
  employeeId?: number
  employeeName?: string
  subject?: string
  reason?: string
  status?: string
  statusReason?: string
  approver?: string
  approverName?: string
  reviewedBy?: string
  handledBy?: string
  decidedBy?: string
  createdAt?: string
  updatedAt?: string
}
