import { useMemo, useState } from 'react';

type UseAttendanceReportFiltersOptions = {
  todayDateKey: string;
  todayMonthIndex: number;
  todayYear: number;
};

export function useAttendanceReportFilters({
  todayDateKey,
  todayMonthIndex,
  todayYear,
}: UseAttendanceReportFiltersOptions) {
  const [year, setYear] = useState(todayYear);
  const [monthIndex, setMonthIndex] = useState(todayMonthIndex);
  const [monthValue, setMonthValue] = useState(
    new Date(todayYear, todayMonthIndex, 1).toLocaleDateString(undefined, {
      month: 'long',
      year: 'numeric',
    })
  );
  const [selectedDateKey, setSelectedDateKey] = useState(todayDateKey);
  const [detailOpen, setDetailOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [departmentFilter, setDepartmentFilter] = useState('all');

  const monthLabel = useMemo(
    () =>
      new Date(year, monthIndex, 1).toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric',
      }),
    [monthIndex, year]
  );

  function parseMonthValue(value: string) {
    const parsed = new Date(`${value} 1`);
    if (Number.isNaN(parsed.getTime())) return;
    setYear(parsed.getFullYear());
    setMonthIndex(parsed.getMonth());
  }

  function shiftCalendarMonth(offset: number) {
    const next = new Date(year, monthIndex + offset, 1);
    setYear(next.getFullYear());
    setMonthIndex(next.getMonth());
  }

  function openDayDetails(day: number) {
    const dateKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setSelectedDateKey(dateKey);
    setDetailOpen(true);
  }

  function clearFilters() {
    setDepartmentFilter('all');
  }

  return {
    actionMenuOpen,
    clearFilters,
    departmentFilter,
    detailOpen,
    filterOpen,
    monthIndex,
    monthLabel,
    monthValue,
    openDayDetails,
    parseMonthValue,
    searchValue,
    selectedDateKey,
    setActionMenuOpen,
    setDepartmentFilter,
    setDetailOpen,
    setFilterOpen,
    setMonthIndex,
    setMonthValue,
    setSearchValue,
    setSelectedDateKey,
    setYear,
    shiftCalendarMonth,
    year,
  };
}

export type UseAttendanceReportFiltersReturn = ReturnType<typeof useAttendanceReportFilters>;
