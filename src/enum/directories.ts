export const Directories = {
  PAYSLIP: 'PAYSLIP',
  LEAVE_REQUEST: 'LEAVE_REQUEST',
  MATERIALS: 'MATERIALS',
  DISPUTE: 'DISPUTE',
  OVERTIME: 'OVERTIME',
  PERSONAL: 'PERSONAL',
  PUBLIC: 'PUBLIC',
  PAYROLL_ITEM: 'PAYROLL_ITEM',
} as const;

export type Directory = typeof Directories[keyof typeof Directories];

export const DocumentEntities = {
  LEAVE_REQUEST: 'leave-request',
  OVERTIME: 'overtime-request',
  PAYSLIP: 'payslip',
  DISPUTE: 'dispute-request',
  PAYROLL_ITEM: 'payroll-item',
} as const;

export type DocumentEntity = typeof DocumentEntities[keyof typeof DocumentEntities];