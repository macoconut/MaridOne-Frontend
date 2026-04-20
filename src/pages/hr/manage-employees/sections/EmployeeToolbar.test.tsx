import { fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import EmployeeToolbar from './EmployeeToolbar';

const baseProps = {
  activeFilterCount: 0,
  departmentFilter: 'all',
  employeeSort: 'id' as const,
  exportMenuOpen: false,
  exportMenuRef: createRef<HTMLDivElement>(),
  filterDepartmentOptions: ['People Operations Department'],
  filterOpen: false,
  filterPositionOptions: ['EMPLOYEE'],
  onClearFilters: vi.fn(),
  onClearSearch: vi.fn(),
  onDepartmentFilterChange: vi.fn(),
  onExportEmployeeData: vi.fn(),
  onPositionFilterChange: vi.fn(),
  onSearchChange: vi.fn(),
  onSortChange: vi.fn(),
  onSortMenuOpenChange: vi.fn(),
  onStatusFilterChange: vi.fn(),
  onToggleExportMenu: vi.fn(),
  onToggleFilterPanel: vi.fn(),
  positionFilter: 'all',
  searchValue: '',
  sortMenuOpen: false,
  statusFilter: 'all',
  statusOptions: ['REGULAR'],
};

describe('EmployeeToolbar', () => {
  it('renders the search box and filter actions', () => {
    render(<EmployeeToolbar {...baseProps} />);

    expect(screen.getByLabelText('Search employees')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Filter' })).toBeInTheDocument();
  });

  it('wires the filter toggle and search change handlers', () => {
    render(<EmployeeToolbar {...baseProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Filter' }));
    fireEvent.change(screen.getByLabelText('Search employees').querySelector('input')!, {
      target: { value: 'alice' },
    });

    expect(baseProps.onToggleFilterPanel).toHaveBeenCalledTimes(1);
    expect(baseProps.onSearchChange).toHaveBeenCalledWith('alice');
  });
});
