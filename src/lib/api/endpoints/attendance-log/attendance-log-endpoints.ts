export const ATTENDANCE_LOG_ENDPOINTS = {
  // queries
  listAttendance: '/api/logs/attendance',
  listTeamAttendance: '/api/logs/attendance/team',
  getMyAttendance: (empId: number) => `/api/logs/attendance/self/${empId}`,

  // actions
  logAttendance: (empId: number) => `/api/logs/attendance/${empId}`,
  importAttendance: '/api/logs/attendance/import',

  // exports & reports
  exportAttendanceReport: '/api/logs/attendance/report/export',
  exportTeamAttendanceReport: '/api/logs/attendance/team/report/export',
  exportMyTimecardPdf: (empId: number) => `/api/logs/attendance/self/${empId}/timecard/pdf`,
};