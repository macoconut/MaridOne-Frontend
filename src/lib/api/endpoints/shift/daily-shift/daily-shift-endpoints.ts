export const DAILY_SHIFT_ENDPOINTS = {
  // queries
  listDailyShifts: (startDate: string, endDate: string) => 
    `/api/employee/schedule/daily?startDate=${startDate}&endDate=${endDate}`,
    
  getEmployeeDailyShifts: (empId: number, startDate: string, endDate: string) => 
    `/api/employee/schedule/daily/${empId}?startDate=${startDate}&endDate=${endDate}`,

  // actions
  upsertOverride: '/api/employee/schedule/daily/override',
  upsertOverrideBatch: '/api/employee/schedule/daily/override/batch',
};