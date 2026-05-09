export type PayrollItemSummaryRow = {
  itemId: number;
  empId?: number;
  employee: string;
  grossPay: number;
  deductions: number;
  netPay: number;
};

export type RunItemViewRow = PayrollItemSummaryRow & {
  role: string;
  department: string;
};

export type ManualLineFormState = {
  empId: string;
  lineType: 'EARNING' | 'BONUS' | 'DEDUCTION';
  amount: string;
};

export type DisputeStatusCode = 'PENDING' | 'WAITING_ADJUSTMENT' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type DisputeStatusFilter = 'all' | DisputeStatusCode;
export type DisputeTypeFilter = 'all' | 'Overtime' | 'Attendance Issue' | 'Absent Deduction' | 'General' | 'Other';

export type DisputeRow = {
  id: number;
  itemId?: number;
  employeeId?: number;
  employeeName?: string;
  employee: string;
  payrollPeriod: string;
  submittedAt: string;
  sortStamp: number;
  statusCode: DisputeStatusCode;
  statusLabel: string;
  statusTone: 'pending' | 'waiting-adjustment' | 'approved' | 'rejected' | 'cancelled';
  subject: string;
  reason: string;
  decisionSummary?: string;
  connectedEntity?: string;
  connectedEntityId?: number;
};

export type RunFormState = {
  periodStart: string;
  periodEnd: string;
  paymentDate: string;
  runType: 'REGULAR' | 'ADJUSTMENT';
};

export type CorrectionIntent = {
  disputeId: number;
  itemId: number;
  employee: string;
  message: string;
  disputeReason: string;
  decisionReason: string;
};

export type CorrectionSourceItem = {
  itemId?: number;
  empId?: number;
  firstName?: string;
  lastName?: string;
  grossPay?: number | string;
  netPay?: number | string;
  runDetails?: {
    id?: number;
    periodStart?: string;
    periodEnd?: string;
    payrollStatus?: string;
    runType?: string;
  };
};

export type CorrectionLine = {
  key: string;
  lineId: number;
  lineType: 'EARNING' | 'DEDUCTION';
  label: string;
  amount: string;
  originalAmount?: string;
  adjustedBy?: string;
  adjustedAt?: string;
};
