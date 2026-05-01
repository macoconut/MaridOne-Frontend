import { FiEdit2 } from 'react-icons/fi';

import {
  formatDashboardDate,
  formatGenderIcon,
  formatTenure,
  type UserDetails,
} from '../dashboardShared';

type EmployeeSummaryCardProps = {
  employee: UserDetails['employee'] | null;
  employeeName: string;
  lastAttendanceLabel: string;
  lastLoginLabel: string;
  profile: UserDetails | null;
  savingEdit: boolean;
  onEdit: () => void;
};

export default function EmployeeSummaryCard({
  employee,
  employeeName,
  lastAttendanceLabel,
  lastLoginLabel,
  savingEdit,
  onEdit,
}: EmployeeSummaryCardProps) {
  const joinDate = employee?.employmentDateStart || employee?.employmentDate || employee?.dateHired;
  const tenureLabel = formatTenure(joinDate);
  const genderIcon = formatGenderIcon(employee?.gender);

  const companyEmail = employee?.companyEmail || employee?.email;
  const personalEmail = employee?.personalEmail;

  return (
    <section className="infoCardX">
      <button
        className="infoCardX__edit"
        type="button"
        onClick={onEdit}
        disabled={savingEdit}
        aria-label="Edit information"
        title="Edit information"
      >
        <FiEdit2 aria-hidden="true" />
      </button>

      <div className="infoCardX__grid">
        <div className="infoCardX__left">
          <div className="infoCardX__photo" aria-hidden="true" />
          <div className="infoCardX__bio">
            <div className="infoCardX__nameRow">
              <div className="infoCardX__name">{employeeName}</div>
              {genderIcon && (
                <span className="infoCardX__genderIcon" aria-hidden="true" title={employee?.gender ?? ''}>
                  {genderIcon}
                </span>
              )}
            </div>
            <div className="statBlock__sub">
              Joined {formatDashboardDate(joinDate)}
            </div>
            {tenureLabel ? (
              <div className="statBlock__sub">{tenureLabel} of service</div>
            ) : null}
          </div>
        </div>

        <div className="infoCardX__divider" />

        <div className="infoCardX__mid">
          {companyEmail && (
            <div className="infoRow">
              <span className="infoRow__icon">✉</span>
              <span className="infoRow__link">{companyEmail}</span>
            </div>
          )}
          {personalEmail && (
            <div className="infoRow">
              <span className="infoRow__icon">✉</span>
              <span>{personalEmail}</span>
            </div>
          )}
          {!companyEmail && !personalEmail && (
            <div className="infoRow">
              <span className="infoRow__icon">✉</span>
              <span>Email not available</span>
            </div>
          )}
          <div className="infoRow">
            <span className="infoRow__icon">☎</span>
            <span>{employee?.phoneNumber || employee?.contactNumber || 'Phone not available'}</span>
          </div>
        </div>

        <div className="infoCardX__divider" />

        <div className="infoCardX__right">
          <div className="statBlock">
            <div className="statBlock__label">Last Portal Login</div>
            <div className="statBlock__value">{lastLoginLabel}</div>
          </div>

          <div className="statBlock">
            <div className="statBlock__label">Recent Attendance</div>
            <div className="statBlock__value">{lastAttendanceLabel}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
