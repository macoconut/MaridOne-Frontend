import { useMemo, useState } from 'react';
import type { EmployeeSortKey } from '@/lib/utils/employeeSort';
import { normalizeText } from '../manageEmployeesShared';
import type { EmployeeRow } from '../types';

export function useEmployeeFilters(employeeRows: EmployeeRow[]) {
  const [searchValue, setSearchValue] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [positionFilter, setPositionFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [employeeSort, setEmployeeSort] = useState<EmployeeSortKey>('id');

  const statusOptions = useMemo(
    () => Array.from(new Set(employeeRows.map((row) => row.status).filter((value) => value && value !== '-'))).sort(),
    [employeeRows]
  );
  const filterPositionOptions = useMemo(
    () => Array.from(new Set(employeeRows.map((row) => row.designation).filter((value) => value && value !== '-'))).sort(),
    [employeeRows]
  );
  const filterDepartmentOptions = useMemo(
    () =>
      Array.from(new Set(employeeRows.map((row) => row.department).filter((value) => value && value !== '-'))).sort(),
    [employeeRows]
  );
  const activeFilterCount = useMemo(
    () => [statusFilter, positionFilter, departmentFilter].filter((value) => value !== 'all').length,
    [departmentFilter, positionFilter, statusFilter]
  );

  function clearFilters() {
    setStatusFilter('all');
    setPositionFilter('all');
    setDepartmentFilter('all');
  }

  function clearSearch() {
    setSearchValue('');
  }

  function toggleFilterPanel() {
    setFilterOpen((open) => {
      const nextOpen = !open;
      if (nextOpen) {
        setSortMenuOpen(false);
      }
      return nextOpen;
    });
    setExportMenuOpen(false);
  }

  function toggleExportMenu() {
    setExportMenuOpen((open) => !open);
    setFilterOpen(false);
  }

  function setSortMenuOpenWithCoordination(open: boolean) {
    setSortMenuOpen(open);
    if (open) {
      setFilterOpen(false);
    }
  }

  return {
    activeFilterCount,
    clearFilters,
    clearSearch,
    departmentFilter,
    employeeSort,
    exportMenuOpen,
    filterDepartmentOptions,
    filterOpen,
    filterPositionOptions,
    positionFilter,
    searchValue,
    setDepartmentFilter,
    setEmployeeSort,
    setExportMenuOpen,
    setFilterOpen,
    setPositionFilter,
    setSearchValue,
    setSortMenuOpen: setSortMenuOpenWithCoordination,
    setStatusFilter,
    sortMenuOpen,
    statusFilter,
    statusOptions,
    toggleExportMenu,
    toggleFilterPanel,
  };
}

export function matchesEmployeeFilters(row: EmployeeRow, filters: Pick<ReturnType<typeof useEmployeeFilters>, 'departmentFilter' | 'positionFilter' | 'searchValue' | 'statusFilter'>) {
  const normalizedSearch = normalizeText(filters.searchValue);
  if (normalizedSearch && !row.searchIndex.includes(normalizedSearch)) return false;
  if (filters.statusFilter !== 'all' && row.status !== filters.statusFilter) return false;
  if (filters.positionFilter !== 'all' && row.designation !== filters.positionFilter) return false;
  if (filters.departmentFilter !== 'all' && row.department !== filters.departmentFilter) return false;
  return true;
}

export type UseEmployeeFiltersReturn = ReturnType<typeof useEmployeeFilters>;
