export type EmployeeAddress = {
  permanentAddress?: string
  temporaryAddress?: string
  city?: string
  state?: string
  country?: string
  zipCode?: string
}

export type EmployeeDetails = {
  id?: number
  employeeId?: number
  firstName?: string
  middleName?: string
  lastName?: string
  fullName?: string
  birthDate?: string
  employmentStatus?: string
  exemptionStatus?: string
  employmentDateStart?: string
  employmentDateEnd?: string
  employmentDate?: string
  dateHired?: string
  yearlySalary?: number | string
  email?: string
  contactNumber?: string
  phoneNumber?: string
  position?: string
  department?: string
  userAccountName?: string
  managerId?: number
  managerName?: string
  taxNumber?: string
  sssNumber?: string
  philhealthNumber?: string
  pagibigNumber?: string
  tinNumber?: string
  emergencyContactName?: string
  emergencyContactRelationship?: string
  emergencyContactNumber?: string
  separationReason?: string
  eligibleForRehire?: boolean
  separationNotes?: string
  separationEffectiveDate?: string
  separationProcessedBy?: string
  address?: EmployeeAddress
}

export type EmployeeOption = {
  id: number
  name: string
  status: string
  position: string
  department: string
}

export type LeaveBalanceRow = {
  leaveId?: number
  balanceHours?: number | string | null
  leaveType?: string
}
