import { AttendanceReportsBoard } from '../../hr/attendance-reports/AttendanceReports';

export default function ManagerAttendanceReports() {
  return (
    <AttendanceReportsBoard
      audienceLabel="Manager"
      logsUrl="/api/logs/attendance/team"
      rosterUrl="/api/employees/team"
      leavesUrl="/api/leave/request/team"
    />
  );
}
