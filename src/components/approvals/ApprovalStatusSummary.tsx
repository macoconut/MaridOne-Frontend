import type { CSSProperties } from 'react';

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
    <section className="hrApprSummary" aria-label={`Approval summary. ${accessibilityLabel}.`}>
      {items.map((item) => {
        const progress = shareProgress(item.value, total);

        return (
          <article key={item.label} className="hrApprSummary__card">
            {item.value > 0 ? (
              <div
                className={`hrApprSummary__ring hrApprSummary__ring--${item.tone}`}
                style={{ '--hr-appr-ring-progress': `${progress}%` } as CSSProperties}
                aria-hidden="true"
              />
            ) : (
              <div className="hrApprSummary__empty" aria-hidden="true">
                -
              </div>
            )}

            <div className="hrApprSummary__body">
              <div className="hrApprSummary__label">{item.label}</div>
              <div className="hrApprSummary__value">{item.value}</div>
            </div>
          </article>
        );
      })}
    </section>
  );
}
