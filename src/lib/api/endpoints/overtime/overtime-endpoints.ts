export const OVERTIME_ENDPOINTS = {
  // queries
  listAllRequests: '/api/overtime/all',
  listTeamRequests: '/api/overtime/team',
  getMyRequests: (empId: number) => `/api/overtime/all/${empId}`,

  // actions
  createRequest: '/api/overtime/create',
  updateRequest: '/api/overtime/update',
  cancelRequest: (overtimeId: number) => `/api/overtime/cancel/${overtimeId}`,
};