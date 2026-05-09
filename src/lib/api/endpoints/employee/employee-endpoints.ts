export const EMPLOYEE_ENDPOINTS = {
  // queries
  listAllEmployees: '/api/employees',
  listTeamEmployees: '/api/employees/team',
  getEmployeeOptions: '/api/employees/options',
  getEmployeeDetails: (id: number) => `/api/employees/${id}`,

  // actions
  createEmployee: '/api/employees/create',
  updateEmployee: (id: number) => `/api/employees/${id}`,
  updateEmployeeStatus: (id: number) => `/api/employees/status/${id}`,
};