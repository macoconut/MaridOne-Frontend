export const BANK_ENDPOINTS = {
  // queries
  getBankAccounts: (empId: number) => `/api/bank/${empId}`,

  // actions
  addBankAccount: (empId: number) => `/api/bank/add/${empId}`,
  updateBankAccount: (empId: number) => `/api/bank/update/${empId}`,
};