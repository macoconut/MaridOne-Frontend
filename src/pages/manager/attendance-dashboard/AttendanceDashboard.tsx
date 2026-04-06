import { AttendanceOverviewDashboard } from '../../hr/dashboard/Dashboard';

export default function ManagerAttendanceDashboard() {
  return (
    <AttendanceOverviewDashboard
      audience="manager"
      logsUrl="/api/logs/attendance/team"
      leavesUrl="/api/leave/request/team"
      rosterUrl="/api/employees/team"
      feedWindowDays={7}
      primaryPanelMode="weekly"
      feedScope="selected-date"
      feedTimeDisplay="time-only"
      descriptionOverride="Track your team's latest attendance activity, late logs, and daily attendance status from one dashboard."
      weeklyWindowAnchor="selected-date"
      weeklyWindowIncludesSelectedDate={false}
    />
  );
}
