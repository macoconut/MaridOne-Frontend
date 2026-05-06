export const PAYROLL_RUN_ENDPOINTS = {
  // queries
  listRuns: '/api/payroll/run',
  getRunById: (payId: number) => `/api/payroll/run/${payId}`,
  getRunSummary: (payId: number) => `/api/payroll/run/summary/${payId}`,
  
  // report-level queries
  getReportSummary: (from: string, to: string) => 
    `/api/payroll/report/summary?from=${from}&to=${to}`,

  // actions
  createRun: '/api/payroll/run/create',
  processRun: '/api/payroll/run/process',
  postRun: (payId: number) => `/api/payroll/run/${payId}/post`,
};