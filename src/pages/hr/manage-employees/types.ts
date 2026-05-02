import type { EmployeeDetails, LeaveBalanceRow } from '../../../lib/types/employee';

export type ModalType = 'add' | 'edit' | 'delete' | null;
export type ConfirmAction = 'edit' | 'delete';
export type LeaveBalanceAdjustmentType = 'add' | 'subtract';
export type LeaveType =
  | 'SICK_LEAVE'
  | 'VACATION_LEAVE'
  | 'MATERNITY_LEAVE'
  | 'PATERNITY_LEAVE'
  | 'SOLO_PARENT_LEAVE'
  | 'MAGNA_CARTA'
  | 'RA9262'
  | 'EMERGENCY_LEAVE';
export type SeparationReason =
  | 'TERMINATED'
  | 'VOLUNTARY_RESIGNATION'
  | 'INVOLUNTARY_SEPARATION'
  | 'END_OF_CONTRACT'
  | 'DECEASED';

export type EmployeeRow = {
  id: string;
  name: string;
  username: string;
  status: string;
  email: string;
  personalEmail: string;
  phone: string;
  position: string;
  department: string;
  exemptionStatus: string;
  searchIndex: string;
};

export type ComplianceDocument = {
  pathId?: number;
  fileName?: string;
  fileType?: string;
  category?: string;
  filePath?: string;
};

export type ComplianceLeaveRecord = {
  requestId?: number;
  leaveType?: string;
  status?: string;
  paid?: boolean;
  startDateTime?: string;
  endDateTime?: string;
  reason?: string;
  approver?: string;
  approverReason?: string;
  approvedAt?: string;
};

export type ComplianceDisputeRecord = {
  disputeId?: number;
  payrollItemId?: number;
  subject?: string;
  reason?: string;
  status?: string;
  statusReason?: string;
  approver?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type ComplianceDisciplinaryAction = {
  action?: string;
  status?: string;
  summary?: string;
  notes?: string;
  recordedBy?: string;
  recordedAt?: string;
};

export type CompliancePerformanceSummary = {
  windowDays?: number;
  attendanceDays?: number;
  completeLogPairs?: number;
  incompleteLogDays?: number;
  totalHours?: number;
  averageHoursPerAttendanceDay?: number;
  averageHoursPerWindowDay?: number;
};

export type ComplianceTimelineEntry = {
  type?: string;
  title?: string;
  detail?: string;
  timestamp?: string;
};

export type ComplianceRecord = {
  employeeId?: number;
  employeeName?: string;
  username?: string;
  employmentStatus?: string;
  position?: string;
  department?: string;
  employmentDateStart?: string;
  employmentDateEnd?: string;
  documents?: ComplianceDocument[];
  leaveRequests?: ComplianceLeaveRecord[];
  disputes?: ComplianceDisputeRecord[];
  disciplinaryActions?: ComplianceDisciplinaryAction[];
  performanceSummary?: CompliancePerformanceSummary;
  timeline?: ComplianceTimelineEntry[];
};

export type EmployeeMutationResponse = {
  id?: number;
  employeeId?: number;
};

export type LeaveBalanceCreateForm = {
  leaveType: LeaveType;
  balanceHours: string;
};

export type LeaveBalanceAdjustForm = {
  balanceHours: string;
  type: LeaveBalanceAdjustmentType;
};

export type FormState = {
  employeeId: string;
  firstName: string;
  middleName: string;
  lastName: string;
  birthDate: string;
  employmentStatus: string;
  exemptionStatus: string;
  employmentDateStart: string;
  employmentDateEnd: string;
  companyEmail: string;
  personalEmail: string;
  phoneNumber: string;
  position: string;
  department: string;
  yearlySalary: string;
  managerId: string;
  username: string;
  accountStatus: string;
  password: string;
  permanentAddress: string;
  temporaryAddress: string;
  city: string;
  state: string;
  country: string;
  zipCode: string;
  sssNumber: string;
  philhealthNumber: string;
  pagibigNumber: string;
  tinNumber: string;
  emergencyContactName: string;
  emergencyContactRelationship: string;
  emergencyContactNumber: string;
  separationReason: SeparationReason | '';
  eligibleForRehire: '' | 'YES' | 'NO';
  separationNotes: string;
};

export type LeaveBalanceStatus = 'idle' | 'loading' | 'ready' | 'error';

export type EmployeeDetailsMap = Record<string, EmployeeDetails>;
export type EmployeeLoadingMap = Record<string, boolean>;
export type EmployeeErrorMap = Record<string, string>;
export type EmployeeComplianceMap = Record<string, ComplianceRecord>;
export type LeaveBalanceMap = Record<string, LeaveBalanceAdjustForm>;

export type OrderedLeaveBalance = LeaveBalanceRow & { leaveType: string };
