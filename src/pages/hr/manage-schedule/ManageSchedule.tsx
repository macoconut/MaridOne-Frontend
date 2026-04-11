import { MonthlyScheduleBoard } from '../../manager/monthly-team-schedule/MonthlyTeamSchedule';

export default function HrManageSchedule() {
  return (
    <MonthlyScheduleBoard
      rosterUrl="/api/employees?page=0&size=5000"
      employeeSingularLabel="employee"
      employeePluralLabel="employees"
      emptyRosterLabel="No employees available"
      selectionHelpText="Search and select one or more employees to review a monthly schedule and batch-update their default weekly hours."
      showDepartmentFilter
      enableBatchSelection
    />
  );
}
