import { fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import AttendanceReportToolbar from './AttendanceReportToolbar';

const baseProps = {
  actionMenuOpen: false,
  actionMenuRef: createRef<HTMLDivElement>(),
  activeFilterCount: 0,
  attendanceStatusFilter: 'all' as const,
  canImport: true,
  departmentFilter: 'all',
  departmentOptions: ['HR'],
  exportDisabled: false,
  exportLoading: false,
  filterOpen: false,
  filterRef: createRef<HTMLDivElement>(),
  importDisabled: false,
  importLoading: false,
  onClearFilters: vi.fn(),
  onClearSearch: vi.fn(),
  onAttendanceStatusFilterChange: vi.fn(),
  onDepartmentFilterChange: vi.fn(),
  onOpenExport: vi.fn(),
  onOpenImport: vi.fn(),
  onSearchChange: vi.fn(),
  onToggleActionMenu: vi.fn(),
  onToggleFilter: vi.fn(),
  searchValue: '',
  shouldShowDepartmentFilter: true,
};

describe('AttendanceReportToolbar', () => {
  it('renders the search box and actions', () => {
    render(<AttendanceReportToolbar {...baseProps} />);

    expect(screen.getByLabelText('Search employees')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Filter' })).toBeInTheDocument();
  });

  it('forwards search and filter actions', () => {
    render(<AttendanceReportToolbar {...baseProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Filter' }));
    fireEvent.change(screen.getByLabelText('Search employees').querySelector('input')!, {
      target: { value: 'alice' },
    });

    expect(baseProps.onToggleFilter).toHaveBeenCalledTimes(1);
    expect(baseProps.onSearchChange).toHaveBeenCalledWith('alice');
  });
});
