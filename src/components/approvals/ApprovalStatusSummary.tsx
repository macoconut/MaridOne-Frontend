import type { CSSProperties } from 'react';
import './ApprovalStatusSummary.css';

type ApprovalStatusTone = 'approved' | 'denied' | 'pending';

type ApprovalStatusSummaryItem = {
  label: string;
  value: number;
  tone: ApprovalStatusTone;
};

type ApprovalStatusSummaryProps = {
  items: ApprovalStatusSummaryItem[];
};

function shareProgress(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.max((value / total) * 100, value > 0 ? 8 : 0);
}

export default function ApprovalStatusSummary({ items }: ApprovalStatusSummaryProps) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const accessibilityLabel =
    total > 0
      ? items.map((item) => `${item.label}: ${item.value}`).join(', ')
      : 'No visible requests';

  return (
    <section className="approvalStatusSummary" aria-label={`Approval summary. ${accessibilityLabel}.`}>
      {items.map((item) => {
        const progress = shareProgress(item.value, total);

        return (
          <article key={item.label} className="approvalStatusSummary__card">
            {item.value > 0 ? (
              <div
                className={`approvalStatusSummary__ring approvalStatusSummary__ring--${item.tone}`}
                style={{ '--approval-status-ring-progress': `${progress}%` } as CSSProperties}
                aria-hidden="true"
              />
            ) : (
              <div className="approvalStatusSummary__empty" aria-hidden="true">
                -
              </div>
            )}

            <div className="approvalStatusSummary__body">
              <div className="approvalStatusSummary__label">{item.label}</div>
              <div className="approvalStatusSummary__value">{item.value}</div>
            </div>
          </article>
        );
      })}
    </section>
  );
}
