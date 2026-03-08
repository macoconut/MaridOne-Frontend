import { useEffect, useMemo, useState } from 'react';
import { apiFetchJson, toArray } from '../../../lib/api';
import { getUserEmail } from '../../../lib/session';
import './Dashboard.css';

type UserDetails = {
  username?: string;
  email?: string;
  employee?: {
    fullName?: string;
    firstName?: string;
    lastName?: string;
    middleName?: string;
    contactNumber?: string;
    address?: string | Record<string, unknown>;
    dateHired?: string;
  };
};

type CalendarEvent = {
  day?: number;
};

function formatAddress(value: unknown) {
  if (typeof value === 'string') return value.trim() || 'Address not available';
  if (!value || typeof value !== 'object') return 'Address not available';

  const data = value as Record<string, unknown>;
  const parts = [
    data.permanentAddress,
    data.temporaryAddress,
    data.city,
    data.state,
    data.country,
    data.zipCode,
  ]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .map((part) => part.trim());

  return parts.length > 0 ? parts.join(', ') : 'Address not available';
}

export default function Dashboard() {
  const [profile, setProfile] = useState<UserDetails | null>(null);
  const [eventDays, setEventDays] = useState<number[]>([]);

  useEffect(() => {
    const username = getUserEmail();
    if (!username) return;

    void (async () => {
      try {
        const details = await apiFetchJson<UserDetails>(`/api/user/details/${encodeURIComponent(username)}`);
        setProfile(details);
      } catch {
        setProfile(null);
      }
    })();
  }, []);

  useEffect(() => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    void (async () => {
      try {
        const events = await apiFetchJson<unknown>(`/api/calendar/events?month=${month}&year=${year}`);
        const days = toArray<CalendarEvent>(events)
          .map((item) => item.day)
          .filter((day): day is number => typeof day === 'number');
        setEventDays(days);
      } catch {
        setEventDays([]);
      }
    })();
  }, []);

  const now = new Date();
  const monthLabel = now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const year = now.getFullYear();
  const monthIndex = now.getMonth();
  const firstDay = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const mondayBasedStart = (firstDay.getDay() + 6) % 7;
  const totalCells = Math.ceil((mondayBasedStart + daysInMonth) / 7) * 7;

  const employeeName = useMemo(() => {
    const emp = profile?.employee;
    const fromParts = [emp?.firstName, emp?.middleName, emp?.lastName]
      .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
      .join(' ');
    return emp?.fullName || fromParts || 'Employee Name';
  }, [profile]);

  return (
    <div className="dashPage">
      {/* INFO CARD */}
      <section className="infoCardX">
        <div className="infoCardX__header">
          <div className="infoCardX__title">Your Information</div>
          <button className="infoCardX__edit" type="button">Edit Info</button>
        </div>

        <div className="infoCardX__grid">
          {/* left */}
          <div className="infoCardX__left">
            <div className="infoCardX__photo" aria-hidden="true" />
            <div className="infoCardX__name">
              {employeeName}
            </div>
          </div>

          <div className="infoCardX__divider" />

          {/* middle */}
          <div className="infoCardX__mid">
            <div className="infoRow">
              <span className="infoRow__icon">⌂</span>
              <span>{formatAddress(profile?.employee?.address)}</span>
            </div>
            <div className="infoRow">
              <span className="infoRow__icon">✉</span>
              <span className="infoRow__link">{profile?.email || 'Email not available'}</span>
            </div>
            <div className="infoRow">
              <span className="infoRow__icon">☎</span>
              <span>{profile?.employee?.contactNumber || 'Phone not available'}</span>
            </div>
          </div>

          <div className="infoCardX__divider" />

          {/* right */}
          <div className="infoCardX__right">
            <div className="statBlock">
              <div className="statBlock__label">Part of Marid since:</div>
              <div className="statBlock__value">{profile?.employee?.dateHired || 'Not available'}</div>
            </div>

            <div className="statBlock">
              <div className="statBlock__label">Last Login:</div>
              <div className="statBlock__value">Not available</div>
            </div>

            <div className="statBlock">
              <div className="statBlock__label">Last attendance:</div>
              <div className="statBlock__value">Not available</div>
            </div>
          </div>
        </div>
      </section>

      {/* ACTION BUTTONS */}
      <section className="actionRowX">
        <button className="actionBtnX" type="button">
          <span>View Payslip</span>
          <span className="actionBtnX__arrow">→</span>
        </button>
        <button className="actionBtnX" type="button">
          <span>View Attendance</span>
          <span className="actionBtnX__arrow">→</span>
        </button>
        <button className="actionBtnX" type="button">
          <span>Request OT</span>
          <span className="actionBtnX__arrow">→</span>
        </button>
        <button className="actionBtnX" type="button">
          <span>Request Leave</span>
          <span className="actionBtnX__arrow">→</span>
        </button>
      </section>

      {/* LOWER */}
      <section className="lowerGridX">
        {/* left column */}
        <div className="lowerColX">
          {/* training */}
          <div className="cardX">
            <div className="cardX__title">Training and Onboarding Materials</div>

            <div className="miniFolders">
              <div className="miniFolder">
                <div className="miniFolder__icon" />
                <div className="miniFolder__body">
                  <div className="miniFolder__name">Updated Training v1.5</div>
                  <ul>
                    <li>Revised workflow and role responsibilities</li>
                    <li>Latest internal tool usage guidelines</li>
                  </ul>
                  <button className="miniFolder__btn" type="button">View Training Materials</button>
                </div>
              </div>

              <div className="miniFolder">
                <div className="miniFolder__icon" />
                <div className="miniFolder__body">
                  <div className="miniFolder__name">Updated Onboarding v1.5</div>
                  <ul>
                    <li>Updated employee account setup process</li>
                    <li>Current onboarding checkpoints and contacts</li>
                  </ul>
                  <button className="miniFolder__btn" type="button">View Onboarding Materials</button>
                </div>
              </div>
            </div>
          </div>

          {/* handbook */}
          <div className="cardX">
            <div className="cardX__title">Employee Handbook</div>

            <div className="handbookRow">
              <div className="handbookRow__icon" />
              <div className="handbookRow__body">
                <div className="handbookRow__name">Updated Handbook v2.1</div>
                <ul>
                  <li>Current HR policies and attendance rules.</li>
                  <li>Code of conduct and reporting procedures.</li>
                </ul>

                <div className="handbookRow__actions">
                  <button className="handbookBtn" type="button">View Handbook</button>
                  <button className="handbookBtn" type="button">Download Handbook</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* right calendar */}
        <div className="cardX cardX--calendar">
          <div className="cardX__title">Company Events</div>
          <div className="calendarShell" aria-label="Company events calendar">
            <div className="calendarShell__top">
              <span>‹</span>
              <strong>{monthLabel}</strong>
              <span>›</span>
            </div>

            <div className="calendarGrid">
              <div className="calHead">MO</div><div className="calHead">TU</div><div className="calHead">WE</div>
              <div className="calHead">TH</div><div className="calHead">FR</div><div className="calHead">SA</div><div className="calHead">SU</div>

              {Array.from({ length: totalCells }).map((_, i) => {
                const dayNumber = i - mondayBasedStart + 1;
                const value = dayNumber > 0 && dayNumber <= daysInMonth ? dayNumber : '';

                return (
                  <div key={i} className="calCell">
                    {value}
                    {typeof value === 'number' && eventDays.includes(value) ? ' *' : ''}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
