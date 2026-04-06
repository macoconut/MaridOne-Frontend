import { AttendanceReportsBoard } from '../../hr/attendance-reports/AttendanceReports';

export default function ManagerAttendanceReports() {
  return (
    <AttendanceReportsBoard
      audienceLabel="Manager"
      logsUrl="/api/logs/attendance/team"
      rosterUrl="/api/employees/team"
      leavesUrl="/api/leave/request/team"
      descriptionOverride="Review your team's daily attendance, missing logs, and attendance gaps in one monthly calendar."
    />
  );
}
