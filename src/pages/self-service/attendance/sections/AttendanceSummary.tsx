type OrderedLeaveBalanceItem = {
  balance?: {
    balanceHours?: number | string | null;
  } | null;
  key: string;
  label: string;
};

type AttendanceSummaryProps = {
  formatBalanceHoursLabel: (value?: number | string | null) => string;
  leaveBalanceStatus: 'loading' | 'ready' | 'unavailable';
  orderedLeaveBalances: OrderedLeaveBalanceItem[];
};

export default function AttendanceSummary({
  formatBalanceHoursLabel,
  leaveBalanceStatus,
  orderedLeaveBalances,
}: AttendanceSummaryProps) {
  return (
    <section className="attBalanceCard" aria-labelledby="att-leave-balances-title">
      <div className="attBalanceCard__header">
        <div className="attBalanceCard__copy">
          <h2 className="attBalanceCard__title" id="att-leave-balances-title">
            Leave Balances
          </h2>
        </div>
      </div>

      {leaveBalanceStatus === 'loading' ? (
        <p className="attBalanceCard__loading">Loading leave balances...</p>
      ) : leaveBalanceStatus === 'unavailable' ? (
        <p className="attBalanceCard__loading">Your leave balances are unavailable right now.</p>
      ) : (
        <div className="attBalanceGrid">
          {orderedLeaveBalances.map((item) => (
            <div key={item.key} className={`attBalancePill${item.balance ? '' : ' attBalancePill--empty'}`}>
              <span className="attBalancePill__label">{item.label}</span>
              <strong className="attBalancePill__value">
                {item.balance ? formatBalanceHoursLabel(item.balance.balanceHours) : 'Not assigned'}
              </strong>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
