import { MonthlyScheduleBoard } from '../../manager/monthly-team-schedule/MonthlyTeamSchedule';

export default function HrManageSchedule() {
  return (
    <MonthlyScheduleBoard
      rosterUrl="/api/employees?page=0&size=5000"
      employeeSingularLabel="employee"
      employeePluralLabel="employees"
      emptyRosterLabel="No employees available"
      selectionHelpText="Pick an employee from the search box to review the monthly calendar, then use Edit Default Hours to update recurring weekly hours for one or more employees."
      showDepartmentFilter
      enableDefaultHoursBatchSelection
    />
  );
}
