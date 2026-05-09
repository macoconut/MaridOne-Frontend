export const USER_ACCOUNT_ENDPOINTS = {
    createUserAccount: "/api/user/create",
    updateUserAccount: (employeeId: number) => `/api/user/update/${employeeId}`,
    changeOwnPassword: '/api/user/password/change',
    getUserAccount: (username: string) => `/api/user/${username}`,
    getDocuments: (username: string) => `/api/user//documents/${username}`,
}