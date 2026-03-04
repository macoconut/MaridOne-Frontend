import { useEffect, useMemo, useState } from 'react';
import { FiChevronLeft, FiChevronRight, FiClock, FiCalendar } from 'react-icons/fi';
import { apiRequest, asArray } from '../../../lib/api';
import './Dashboard.css';

type EmployeeRecord = {
  employeeId?: number | string;
  id?: number | string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  department?: string;
  departmentName?: string;
  position?: string;
  employmentStatus?: string;
};

type AttendanceLogRecord = {
  id?: number | string;
  employeeId?: number | string;
  employeeName?: string;
  name?: string;
  department?: string;
  position?: string;
  status?: string;
  attendanceStatus?: string;
  lateMinutes?: number;
  durationMinutes?: number;
  timeIn?: string;
  createdAt?: string;
  timestamp?: string;
};

function getFullName(employee: EmployeeRecord): string {
  const parts = [employee.firstName, employee.middleName, employee.lastName]
    .map((part) => (part ?? '').trim())
    .filter(Boolean);
  if (parts.length > 0) return parts.join(' ');
  const id = employee.employeeId ?? employee.id;
  return id ? `Employee #${id}` : 'Unknown employee';
}

function formatRelativeTime(isoLike?: string): string {
  if (!isoLike) return 'N/A';
  const parsed = new Date(isoLike);
  if (Number.isNaN(parsed.getTime())) return 'N/A';
  const deltaMs = Date.now() - parsed.getTime();
  const deltaMinutes = Math.max(Math.floor(deltaMs / 60000), 0);
  if (deltaMinutes < 1) return 'Just now';
  if (deltaMinutes < 60) return `${deltaMinutes}m ago`;
  const deltaHours = Math.floor(deltaMinutes / 60);
  if (deltaHours < 24) return `${deltaHours}h ago`;
  const deltaDays = Math.floor(deltaHours / 24);
  return `${deltaDays}d ago`;
}

export default function HrDashboard() {
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLogRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadDashboardData() {
      setIsLoading(true);
      setErrorMessage('');

      const results = await Promise.allSettled([
        apiRequest<unknown>('/api/employees?page=0&size=200'),
        apiRequest<unknown>('/api/logs/attendance?page=0&size=100'),
      ]);

      if (!isMounted) return;

      const [employeesResult, attendanceResult] = results;

      if (employeesResult.status === 'fulfilled') {
        setEmployees(asArray<EmployeeRecord>(employeesResult.value));
      } else {
        setEmployees([]);
      }

      if (attendanceResult.status === 'fulfilled') {
        setAttendanceLogs(asArray<AttendanceLogRecord>(attendanceResult.value));
      } else {
        setAttendanceLogs([]);
      }

      if (employeesResult.status === 'rejected' || attendanceResult.status === 'rejected') {
        setErrorMessage('Some dashboard data failed to load. Check backend and try again.');
      }

      setIsLoading(false);
    }

    void loadDashboardData();

    return () => {
      isMounted = false;
    };
  }, []);

  const todayLabel = useMemo(
    () => new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
    []
  );

  const metricCards = useMemo(() => {
    const absent = employees.length > attendanceLogs.length ? employees.length - attendanceLogs.length : 0;
    const onTime = attendanceLogs.filter((log) => {
      const status = (log.attendanceStatus ?? log.status ?? '').toUpperCase();
      return status.includes('ON_TIME') || status.includes('ONTIME') || status.includes('PRESENT');
    }).length;
    const late = attendanceLogs.filter((log) => {
      const status = (log.attendanceStatus ?? log.status ?? '').toUpperCase();
      return status.includes('LATE') || (log.lateMinutes ?? 0) > 0;
    }).length;
    return [
      { label: 'Present', value: attendanceLogs.length },
      { label: 'Absent', value: absent },
      { label: 'On Time', value: onTime },
      { label: 'Late', value: late },
    ];
  }, [attendanceLogs, employees.length]);

  const departments = useMemo(() => {
    const uniq = new Set<string>();
    for (const employee of employees) {
      const department = (employee.departmentName ?? employee.department ?? '').trim();
      if (department) uniq.add(department);
    }
    return Array.from(uniq).slice(0, 3);
  }, [employees]);

  const lateToday = useMemo(() => {
    return attendanceLogs
      .filter((log) => {
        const status = (log.attendanceStatus ?? log.status ?? '').toUpperCase();
        return status.includes('LATE') || (log.lateMinutes ?? 0) > 0;
      })
      .slice(0, 5)
      .map((log, idx) => ({
        id: String(log.id ?? idx),
        name: (log.employeeName ?? log.name ?? '').trim() || `Employee #${log.employeeId ?? 'N/A'}`,
        department: (log.department ?? '').trim() || 'Unassigned department',
        position: (log.position ?? '').trim() || 'Unassigned position',
        timeIn: log.timeIn ? new Date(log.timeIn).toLocaleTimeString() : 'N/A',
        duration: `${log.lateMinutes ?? log.durationMinutes ?? 0}m`,
        period: 'Today',
      }));
  }, [attendanceLogs]);

  const onLeave = useMemo(() => {
    return employees
      .filter((employee) => (employee.employmentStatus ?? '').toUpperCase().includes('LEAVE'))
      .slice(0, 5)
      .map((employee, idx) => ({
        id: String(employee.employeeId ?? employee.id ?? idx),
        name: getFullName(employee),
        department: (employee.departmentName ?? employee.department ?? '').trim() || 'Unassigned department',
        position: (employee.position ?? '').trim() || 'Unassigned position',
        period: 'Current leave period',
      }));
  }, [employees]);

  const attendanceFeed = useMemo(() => {
    return attendanceLogs.slice(0, 12).map((log, idx) => ({
      id: String(log.id ?? idx),
      name: (log.employeeName ?? log.name ?? '').trim() || `Employee #${log.employeeId ?? 'N/A'}`,
      department: (log.department ?? '').trim() || 'Unassigned department',
      position: (log.position ?? '').trim() || 'Unassigned position',
      time: formatRelativeTime(log.createdAt ?? log.timestamp ?? log.timeIn),
    }));
  }, [attendanceLogs]);

  return (
    <div className="hrDash">
      <div className="hrDash__top">
        <div>
          <h1 className="hrDash__title">Attendance Dashboard</h1>
          <p className="hrDash__subtitle">{todayLabel}</p>
        </div>

        <button className="hrDash__exportBtn" type="button">
          Export Attendance
          <br />
          Analytics
        </button>
      </div>

      <div className="hrDash__grid">
        <div className="hrDash__mainCol">
          <section className="hrStatRow">
            {metricCards.map((card) => (
              <article key={card.label} className="hrStatCard">
                <div className="hrStatCard__ring" />
                <div className="hrStatCard__body">
                  <div className="hrStatCard__label">{card.label}</div>
                  <div className="hrStatCard__value">{card.value}</div>
                </div>
              </article>
            ))}
          </section>

          <section className="hrPanel">
            <div className="hrPanel__header">Departmental Attendance</div>
            <div className="hrDept">
              <button className="hrCircleBtn" type="button" aria-label="Previous department page">
                <FiChevronLeft />
              </button>

              <div className="hrDept__cards">
                {departments.length > 0 ? (
                  departments.map((dept, idx) => (
                    <div key={`${dept}-${idx}`} className="hrDonutCard">
                      <div className="hrDonut" />
                      <div className="hrDonutCard__name">{dept}</div>
                    </div>
                  ))
                ) : (
                  <div className="hrDonutCard">
                    <div className="hrDonut" />
                    <div className="hrDonutCard__name">No departments available</div>
                  </div>
                )}
              </div>

              <button className="hrCircleBtn" type="button" aria-label="Next department page">
                <FiChevronRight />
              </button>
            </div>

            <div className="hrPager" aria-hidden="true">
              <span className="is-active" />
              <span />
              <span />
            </div>

            <div className="hrLegend">
              <span className="hrLegend__item">On Time</span>
              <span className="hrLegend__item">Late</span>
              <span className="hrLegend__item">Absent</span>
              <span className="hrLegend__item">On Leave</span>
              <span className="hrLegend__item">Day Off</span>
            </div>
          </section>

          <div className="hrDash__bottomRow">
            <section className="hrPanel hrListPanel">
              <div className="hrPanel__header">Late Today</div>
              <div className="hrPeopleList">
                {lateToday.length > 0 ? (
                  lateToday.map((item) => (
                    <article key={item.id} className="hrPerson">
                      <div className="hrPerson__avatar" />
                      <div className="hrPerson__body">
                        <div className="hrPerson__name">{item.name}</div>
                        <div className="hrPerson__meta">{item.department}</div>
                        <div className="hrPerson__meta">{item.position}</div>
                        <div className="hrPerson__infoRow">
                          <span>
                            <FiClock /> {item.timeIn}
                          </span>
                          <span>
                            <FiClock /> {item.duration}
                          </span>
                          <span>
                            <FiCalendar /> {item.period}
                          </span>
                        </div>
                      </div>
                    </article>
                  ))
                ) : (
                  <article className="hrPerson">
                    <div className="hrPerson__body">
                      <div className="hrPerson__name">No late attendance records.</div>
                    </div>
                  </article>
                )}
              </div>
            </section>

            <section className="hrPanel hrListPanel">
              <div className="hrPanel__header">On Leave</div>
              <div className="hrPeopleList">
                {onLeave.length > 0 ? (
                  onLeave.map((item) => (
                    <article key={item.id} className="hrPerson">
                      <div className="hrPerson__avatar" />
                      <div className="hrPerson__body">
                        <div className="hrPerson__name">{item.name}</div>
                        <div className="hrPerson__meta">{item.department}</div>
                        <div className="hrPerson__meta">{item.position}</div>
                        <div className="hrPerson__infoRow">
                          <span>
                            <FiCalendar /> {item.period}
                          </span>
                        </div>
                      </div>
                    </article>
                  ))
                ) : (
                  <article className="hrPerson">
                    <div className="hrPerson__body">
                      <div className="hrPerson__name">No employees currently marked on leave.</div>
                    </div>
                  </article>
                )}
              </div>
            </section>
          </div>
        </div>

        <section className="hrPanel hrFeedPanel">
          <div className="hrPanel__header">Attendance Feed</div>
          <div className="hrPeopleList">
            {attendanceFeed.length > 0 ? (
              attendanceFeed.map((item) => (
                <article key={item.id} className="hrPerson">
                  <div className="hrPerson__avatar" />
                  <div className="hrPerson__body">
                    <div className="hrPerson__name">{item.name}</div>
                    <div className="hrPerson__meta">{item.department}</div>
                    <div className="hrPerson__meta">{item.position}</div>
                  </div>
                  <div className="hrPerson__time">{item.time}</div>
                </article>
              ))
            ) : (
              <article className="hrPerson">
                <div className="hrPerson__body">
                  <div className="hrPerson__name">No attendance feed available.</div>
                </div>
              </article>
            )}
          </div>
        </section>
      </div>
      {(isLoading || errorMessage) && (
        <div className="hrDash__subtitle" style={{ marginTop: 12 }}>
          {isLoading ? 'Loading dashboard data...' : errorMessage}
        </div>
      )}
    </div>
  );
}
