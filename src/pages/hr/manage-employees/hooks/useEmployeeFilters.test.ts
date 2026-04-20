import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useEmployeeFilters } from './useEmployeeFilters';

const rows = [
  {
    id: '1',
    name: 'Alice Cruz',
    username: 'alice',
    status: 'REGULAR',
    email: 'alice@example.com',
    phone: '09171234567',
    position: 'EMPLOYEE',
    department: 'People Operations Department',
    exemptionStatus: 'NON_EXEMPT',
    searchIndex: 'alice cruz regular employee people operations department',
  },
];

describe('useEmployeeFilters', () => {
  it('starts with empty search and default filters', () => {
    const { result } = renderHook(() => useEmployeeFilters(rows));

    expect(result.current.searchValue).toBe('');
    expect(result.current.statusFilter).toBe('all');
    expect(result.current.positionFilter).toBe('all');
    expect(result.current.departmentFilter).toBe('all');
    expect(result.current.employeeSort).toBe('id');
    expect(result.current.activeFilterCount).toBe(0);
  });

  it('updates controls and clears filter selections', () => {
    const { result } = renderHook(() => useEmployeeFilters(rows));

    act(() => {
      result.current.setSearchValue('alice');
      result.current.setStatusFilter('REGULAR');
      result.current.setPositionFilter('EMPLOYEE');
      result.current.setDepartmentFilter('People Operations Department');
    });

    expect(result.current.searchValue).toBe('alice');
    expect(result.current.activeFilterCount).toBe(3);

    act(() => result.current.clearFilters());

    expect(result.current.statusFilter).toBe('all');
    expect(result.current.positionFilter).toBe('all');
    expect(result.current.departmentFilter).toBe('all');
    expect(result.current.searchValue).toBe('alice');
  });
});
