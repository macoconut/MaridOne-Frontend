export const PAYROLL_ITEM_COMPONENTS_ENDPOINTS = {
  // queries
  getEarnings: (itemId: number) => `/api/payroll/item/earnings/${itemId}`,
  getDeductions: (itemId: number) => `/api/payroll/item/deductions/${itemId}`,
  getEmployerContributions: (itemId: number) => `/api/payroll/item/employer-contributions/${itemId}`,
  getPayslipPdf: (itemId: number) => `/api/payroll/item/${itemId}/payslip/pdf`,

  // actions
  createEarning: (itemId: number) => `/api/payroll/item/earnings/create/${itemId}`,
  createDeduction: (itemId: number) => `/api/payroll/item/deductions/create/${itemId}`,
  updateEarning: (earningsId: number) => `/api/payroll/item/earnings/update/${earningsId}`,
  updateDeduction: (deductionsId: number) => `/api/payroll/item/deductions/update/${deductionsId}`,
};