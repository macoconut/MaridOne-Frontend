export const TEMPLATE_SHIFT_ENDPOINTS = {
  // queries
  getEmployeeTemplates: (empId: number) => `/api/employee/schedule/${empId}`,

  // actions
  addTemplate: '/api/employee/schedule/add',
  updateTemplate: '/api/employee/schedule/update',
  deleteTemplate: (shiftId: number) => `/api/employee/schedule/${shiftId}`,
};