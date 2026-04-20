export type AttendanceLog = {
  attendanceId?: number
  employeeId?: number
  timestamp?: string
  direction?: string
}

export type AttendanceLeaveRequest = {
  requestId?: number
  empId?: number
  employeeId?: number
  startDateTime?: string
  endDateTime?: string
  requestStatus?: string
  reason?: string
  leaveType?: string
  isPaid?: boolean
  paid?: boolean
}

export type AttendanceOvertimeRequest = {
  overtimeId?: number
  employeeId?: number
  requestStatus?: string
  workDate?: string
  overtimeType?: string
  startTime?: string
  endTime?: string
  reason?: string
}

export type ShiftSchedule = {
  shiftId?: number
  employeeId?: number
  startTime?: string
  endTime?: string
  dayOfWeek?: string
}

export type DailyShift = {
  dailyShiftId?: number
  employeeId?: number
  workDate?: string
  startDateTime?: string
  endDateTime?: string
  dayOff?: boolean
}

export type AttendanceEmployeeRow = {
  id: number
  name: string
  status: string
  position: string
  department?: string
  shiftSchedules: ShiftSchedule[]
  employmentDateStart?: string
}

export type HolidayLookupPayload = {
  holidayDates?: string[]
  regularHolidayDates?: string[]
}
