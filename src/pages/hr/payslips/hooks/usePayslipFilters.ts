import { useState } from 'react';
import type { EmployeeSortKey } from '../../../../lib/utils/employeeSort';
import type { DisputeStatusFilter, DisputeTypeFilter } from '../types';

export function usePayslipFilters() {
  const [runItemFilterOpen, setRunItemFilterOpen] = useState(false);
  const [runItemSortOpen, setRunItemSortOpen] = useState(false);
  const [runItemRoleFilter, setRunItemRoleFilter] = useState('all');
  const [runItemDepartmentFilter, setRunItemDepartmentFilter] = useState('all');
  const [disputeSearchValue, setDisputeSearchValue] = useState('');
  const [disputeFilterOpen, setDisputeFilterOpen] = useState(false);
  const [disputeStatusFilter, setDisputeStatusFilter] = useState<DisputeStatusFilter>('all');
  const [disputeTypeFilter, setDisputeTypeFilter] = useState<DisputeTypeFilter>('all');
  const [runItemSort, setRunItemSort] = useState<EmployeeSortKey>('name');

  function clearDisputeFilters() {
    setDisputeStatusFilter('all');
    setDisputeTypeFilter('all');
  }

  function clearRunItemFilters() {
    setRunItemRoleFilter('all');
    setRunItemDepartmentFilter('all');
  }

  return {
    clearDisputeFilters,
    clearRunItemFilters,
    disputeFilterOpen,
    disputeSearchValue,
    disputeStatusFilter,
    disputeTypeFilter,
    runItemDepartmentFilter,
    runItemFilterOpen,
    runItemRoleFilter,
    runItemSort,
    runItemSortOpen,
    setDisputeFilterOpen,
    setDisputeSearchValue,
    setDisputeStatusFilter,
    setDisputeTypeFilter,
    setRunItemDepartmentFilter,
    setRunItemFilterOpen,
    setRunItemRoleFilter,
    setRunItemSort,
    setRunItemSortOpen,
  };
}

export type UsePayslipFiltersReturn = ReturnType<typeof usePayslipFilters>;
