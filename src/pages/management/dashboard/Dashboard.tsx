import { FiBarChart2, FiPieChart, FiTrendingUp } from 'react-icons/fi';
import './Dashboard.css';

function TrendCard({ title }: { title: string }) {
  return (
    <section className="mDashCard">
      <div className="mDashCard__head">{title}</div>
      <div className="mDashCard__body">
        <div className="mDashCard__iconWrap">
          <FiPieChart className="mDashCard__icon" />
        </div>
        <div className="mDashCard__image" aria-label={`${title} visual placeholder`} />
      </div>
    </section>
  );
}

export default function ManagementDashboard() {
  return (
    <section className="mDash">
      <div className="mDashTop">
        <div>
          <h1>Sales Dashboard</h1>
          <p>Thursday, April 6, 2024</p>
        </div>
        <button type="button" className="mDashTop__btn">
          Export Attendance Analytics
        </button>
      </div>

      <div className="mDashGrid">
        <div className="mDashGrid__left">
          <TrendCard title="Current Trends" />
          <TrendCard title="Sales Summary:" />
        </div>

        <section className="mDashCard mDashReports">
          <div className="mDashCard__head">Reports</div>
          <div className="mDashReports__body">
            <FiBarChart2 className="mDashReports__icon" />
            <FiTrendingUp className="mDashReports__icon" />
          </div>
        </section>
      </div>
    </section>
  );
}
