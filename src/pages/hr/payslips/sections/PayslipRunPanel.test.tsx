import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PayslipRunPanel from './PayslipRunPanel';

const baseProps = {
  activeRunItemFilterCount: 0,
  canAddManualAdjustmentLine: false,
  canPostCurrentRun: false,
  canViewNextInProgressRun: false,
  canViewPreviousInProgressRun: false,
  currentInProgressRunIndex: 0,
  currentPayPeriod: 'Apr 15, 2026',
  currentRun: null,
  displayedPeriodEnd: '2026-04-10',
  displayedPeriodStart: '2026-03-26',
  emptyRunHint: '',
  hasMultipleInProgressRuns: false,
  inProgressRunCount: 0,
  isCurrentRunInProgress: false,
  isLoadingRunItems: false,
  isPostingRun: false,
  isSubmittingManualLine: false,
  onClearRunItemFilters: vi.fn(),
  onOpenManualLineModal: vi.fn(),
  onOpenPayrollItemDetail: vi.fn(),
  onOpenPostModal: vi.fn(),
  onOpenRunModal: vi.fn(),
  onRunItemDepartmentFilterChange: vi.fn(),
  onRunItemRoleFilterChange: vi.fn(),
  onRunItemSortChange: vi.fn(),
  onRunItemSortOpenChange: vi.fn(),
  onShowNextRun: vi.fn(),
  onShowPreviousRun: vi.fn(),
  onToggleRunItemFilter: vi.fn(),
  runItemDepartmentFilter: 'all',
  runItemDepartmentOptions: [] as string[],
  runItemFilterOpen: false,
  runItemRoleFilter: 'all',
  runItemRoleOptions: [] as string[],
  runItemSort: 'name' as const,
  runItemSortOpen: false,
  runItemsCount: 0,
  visibleRunItems: [],
};

describe('PayslipRunPanel', () => {
  it('renders the pay-period header and create action', () => {
    render(<PayslipRunPanel {...baseProps} />);

    expect(screen.getByText('Current Pay Period:')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create New Payroll Run' })).toBeInTheDocument();
  });

  it('shows the empty adjustment-run state when an in-progress run has no items', () => {
    render(
      <PayslipRunPanel
        {...baseProps}
        canAddManualAdjustmentLine
        currentRun={{
          payId: 12,
          paymentDate: '2026-04-15',
          periodStart: '2026-03-26',
          periodEnd: '2026-04-10',
          runType: 'ADJUSTMENT',
          payrollStatus: 'IN_PROGRESS',
          itemCount: 0,
        }}
        isCurrentRunInProgress
      />
    );

    expect(
      screen.getByText(
        'No payroll items yet for this in-progress run. Add a manual adjustment line to create the first payroll item.'
      )
    ).toBeInTheDocument();
  });
});
