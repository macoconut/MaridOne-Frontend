import { FiEdit2 } from 'react-icons/fi';

import {
  formatAddress,
  formatDashboardDate,
  formatGenderLabel,
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
  profile,
  savingEdit,
  onEdit,
}: EmployeeSummaryCardProps) {
  const joinDate = employee?.employmentDateStart || employee?.employmentDate || employee?.dateHired;
  const tenureLabel = formatTenure(joinDate);

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
            <div className="infoCardX__name">{employeeName}</div>
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
          <div className="infoRow">
            <span className="infoRow__icon">✉</span>
            <span className="infoRow__link">{employee?.email || profile?.username || 'Email not available'}</span>
          </div>
          <div className="infoRow">
            <span className="infoRow__icon">☎</span>
            <span>{employee?.phoneNumber || employee?.contactNumber || 'Phone not available'}</span>
          </div>
          <div className="infoRow">
            <span className="infoRow__icon">◌</span>
            <span>{formatGenderLabel(employee?.gender)}</span>
          </div>
          <div className="infoRow">
            <span className="infoRow__icon">⌂</span>
            <span>{formatAddress(employee?.address)}</span>
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
