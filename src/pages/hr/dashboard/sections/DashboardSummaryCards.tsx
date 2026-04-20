import {
  METRIC_CARD_ROWS,
  type AttendanceStatusKey,
  type MetricCard,
} from '../dashboardShared';

type DashboardSummaryCardsProps = {
  metricCards: Record<AttendanceStatusKey, MetricCard>;
};

export default function DashboardSummaryCards({ metricCards }: DashboardSummaryCardsProps) {
  return (
    <>
      {METRIC_CARD_ROWS.map((row) => (
        <section key={row.join('-')} className={`hrStatRow hrStatRow--${row.length}`}>
          {row.map((key) => {
            const card = metricCards[key];
            return (
              <article key={card.key} className="hrStatCard">
                <div className="hrStatCard__ring" style={card.ringStyle}>
                  <span className="hrStatCard__valueInRing">{card.value}</span>
                </div>
                <div className="hrStatCard__body">
                  <div className="hrStatCard__label">{card.label}</div>
                  <div className="hrStatCard__helper">{card.helper}</div>
                </div>
              </article>
            );
          })}
        </section>
      ))}
    </>
  );
}
