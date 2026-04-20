import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PayslipDisputesPanel from './PayslipDisputesPanel';

const baseProps = {
  activeDisputeFilterCount: 0,
  disputeFilterOpen: false,
  disputeSearchValue: '',
  disputeStatusFilter: 'all' as const,
  disputeTypeFilter: 'all' as const,
  disputesCount: 1,
  onClearDisputeFilters: vi.fn(),
  onClearDisputeSearch: vi.fn(),
  onDisputeSearchChange: vi.fn(),
  onDisputeStatusFilterChange: vi.fn(),
  onDisputeTypeFilterChange: vi.fn(),
  onOpenDisputeRow: vi.fn(),
  onToggleDisputeFilter: vi.fn(),
  visibleDisputes: [
    {
      id: 1,
      itemId: 10,
      employeeId: 7,
      employee: 'Alice Reyes (EMP-7)',
      payrollPeriod: 'Apr 1, 2026',
      submittedAt: 'Apr 20, 2026 9:00 AM',
      sortStamp: 1,
      statusCode: 'PENDING' as const,
      statusLabel: 'Pending',
      statusTone: 'pending' as const,
      subject: 'Attendance Issue',
      reason: 'Missing one overtime entry',
      decisionSummary: '',
    },
  ],
};

describe('PayslipDisputesPanel', () => {
  it('renders dispute rows from props', () => {
    render(<PayslipDisputesPanel {...baseProps} />);

    expect(screen.getByText('Payroll Dispute from Employees')).toBeInTheDocument();
    expect(screen.getByText('Alice Reyes (EMP-7)')).toBeInTheDocument();
    expect(screen.getByText('Attendance Issue')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('shows the empty state when there are no disputes to display', () => {
    render(
      <PayslipDisputesPanel
        {...baseProps}
        disputesCount={0}
        visibleDisputes={[]}
      />
    );

    expect(
      screen.getByText('No payroll disputes have been submitted yet. New employee disputes will show up here.')
    ).toBeInTheDocument();
  });
});
