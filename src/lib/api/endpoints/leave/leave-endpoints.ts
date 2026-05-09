export const LEAVE_ENDPOINTS = {
  // balance
  getBalance: (empId: number) => `/api/leave/balance/${empId}`,
  createBalance: (empId: number) => `/api/leave/balance/${empId}`,
  updateBalance: (empId: number) => `/api/leave/balance/update/${empId}`,

  // requests
  listRequests: '/api/leave/request',
  listTeamRequests: '/api/leave/request/team',
  getMyRequests: (empId: number) => `/api/leave/request/${empId}`,
  getRequestDetails: (requestId: number) => `/api/leave/request/details/${requestId}`,

  // actions
  createRequest: (empId: number) => `/api/leave/create/${empId}`,
  updateRequest: (requestId: number) => `/api/leave/update/${requestId}`,
  cancelRequest: (requestId: number) => `/api/leave/request/cancel/${requestId}`,
};