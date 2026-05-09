export const PAYROLL_ITEM_ENDPOINTS = {
  // queries
  getMyItems: (empId: number) => `/api/payroll/item/${empId}`,
  getRunItems: (payId: number) => `/api/payroll/run/${payId}/items`,
  getItemForCorrection: (itemId: number) => `/api/payroll/item/manage/${itemId}`,
  
  // report-level queries
  getReportItems: (from: string, to: string) => 
    `/api/payroll/report/items?from=${from}&to=${to}`,

  // actions
  createItem: '/api/payroll/item/create',
  addLineCorrection: (payId: number) => `/api/payroll/run/${payId}/adjustment/correction`,
};