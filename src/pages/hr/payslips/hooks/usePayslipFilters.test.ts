import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { usePayslipFilters } from './usePayslipFilters';

describe('usePayslipFilters', () => {
  it('starts with empty search and default filters', () => {
    const { result } = renderHook(() => usePayslipFilters());

    expect(result.current.disputeSearchValue).toBe('');
    expect(result.current.disputeStatusFilter).toBe('all');
    expect(result.current.disputeTypeFilter).toBe('all');
    expect(result.current.runItemRoleFilter).toBe('all');
    expect(result.current.runItemDepartmentFilter).toBe('all');
    expect(result.current.runItemSort).toBe('name');
  });

  it('updates dispute and run-item controls', () => {
    const { result } = renderHook(() => usePayslipFilters());

    act(() => result.current.setDisputeSearchValue('alice'));
    act(() => result.current.setDisputeStatusFilter('PENDING'));
    act(() => result.current.setDisputeTypeFilter('Overtime'));
    act(() => result.current.setRunItemRoleFilter('Engineer'));
    act(() => result.current.setRunItemDepartmentFilter('Finance'));
    act(() => result.current.setRunItemSort('id'));

    expect(result.current.disputeSearchValue).toBe('alice');
    expect(result.current.disputeStatusFilter).toBe('PENDING');
    expect(result.current.disputeTypeFilter).toBe('Overtime');
    expect(result.current.runItemRoleFilter).toBe('Engineer');
    expect(result.current.runItemDepartmentFilter).toBe('Finance');
    expect(result.current.runItemSort).toBe('id');
  });

  it('clears both filter groups without resetting the search text', () => {
    const { result } = renderHook(() => usePayslipFilters());

    act(() => {
      result.current.setDisputeSearchValue('needs review');
      result.current.setDisputeStatusFilter('WAITING_ADJUSTMENT');
      result.current.setDisputeTypeFilter('General');
      result.current.setRunItemRoleFilter('Manager');
      result.current.setRunItemDepartmentFilter('HR');
    });

    act(() => result.current.clearDisputeFilters());
    act(() => result.current.clearRunItemFilters());

    expect(result.current.disputeSearchValue).toBe('needs review');
    expect(result.current.disputeStatusFilter).toBe('all');
    expect(result.current.disputeTypeFilter).toBe('all');
    expect(result.current.runItemRoleFilter).toBe('all');
    expect(result.current.runItemDepartmentFilter).toBe('all');
  });
});
