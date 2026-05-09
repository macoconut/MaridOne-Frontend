export const DISPUTE_ENDPOINTS = {
  // queries
  listAllDisputes: '/api/payroll/item/dispute/all',
  getDisputeDetails: (disputeId: number) => `/api/payroll/item/dispute/details/${disputeId}`,
  
  getMyDisputes: (empId: number, status?: string) => {
    const baseUrl = `/api/payroll/item/dispute/self?empId=${empId}`;
    return status ? `${baseUrl}&status=${status}` : baseUrl;
  },

  // actions
  createDispute: (itemId: number) => `/api/payroll/item/dispute/create/${itemId}`,
  updateDispute: (disputeId: number) => `/api/payroll/item/dispute/update/${disputeId}`,
  cancelDispute: (disputeId: number) => `/api/payroll/item/dispute/cancel/${disputeId}`,
};