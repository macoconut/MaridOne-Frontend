import type { RefObject } from 'react';
import {
  FiDownload,
  FiFilter,
  FiMoreVertical,
  FiSearch,
  FiUpload,
  FiXCircle,
} from 'react-icons/fi';

type AttendanceReportToolbarProps = {
  actionMenuOpen: boolean;
  actionMenuRef: RefObject<HTMLDivElement | null>;
  activeFilterCount: number;
  canImport: boolean;
  departmentFilter: string;
  departmentOptions: string[];
  exportDisabled: boolean;
  exportLoading: boolean;
  filterOpen: boolean;
  filterRef: RefObject<HTMLDivElement | null>;
  importDisabled: boolean;
  importLoading: boolean;
  onClearFilters: () => void;
  onClearSearch: () => void;
  onDepartmentFilterChange: (value: string) => void;
  onOpenExport: () => void;
  onOpenImport: () => void;
  onSearchChange: (value: string) => void;
  onToggleActionMenu: () => void;
  onToggleFilter: () => void;
  searchValue: string;
  shouldShowDepartmentFilter: boolean;
};

export default function AttendanceReportToolbar({
  actionMenuOpen,
  actionMenuRef,
  activeFilterCount,
  canImport,
  departmentFilter,
  departmentOptions,
  exportDisabled,
  exportLoading,
  filterOpen,
  filterRef,
  importDisabled,
  importLoading,
  onClearFilters,
  onClearSearch,
  onDepartmentFilterChange,
  onOpenExport,
  onOpenImport,
  onSearchChange,
  onToggleActionMenu,
  onToggleFilter,
  searchValue,
  shouldShowDepartmentFilter,
}: AttendanceReportToolbarProps) {
  return (
    <div className="hrAtt__toolbar">
      <label className="uSearch" aria-label="Search employees">
        <FiSearch />
        <input
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search employee, role, or department"
        />
        {searchValue ? (
          <button type="button" aria-label="Clear search" onClick={onClearSearch}>
            <FiXCircle />
          </button>
        ) : null}
      </label>

      <div className="hrAtt__toolbarActions">
        {shouldShowDepartmentFilter ? (
          <div className="uFilter" ref={filterRef}>
            <button
              type="button"
              className={`uFilter__toggle ${filterOpen ? 'is-open' : ''} ${activeFilterCount > 0 ? 'is-active' : ''}`}
              onClick={onToggleFilter}
            >
              <FiFilter />
              <span>Filter</span>
            </button>

            {filterOpen ? (
              <div className="uFilter__panel">
                <label className="uFilter__field">
                  <span>Department</span>
                  <select value={departmentFilter} onChange={(event) => onDepartmentFilterChange(event.target.value)}>
                    <option value="all">All Departments</option>
                    {departmentOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="uFilter__actions">
                  <button type="button" onClick={onClearFilters}>
                    Clear Filters
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="hrAttMenu" ref={actionMenuRef}>
          <button
            type="button"
            className={`hrAttMenu__toggle ${actionMenuOpen ? 'is-open' : ''}`}
            onClick={onToggleActionMenu}
            aria-haspopup="menu"
            aria-expanded={actionMenuOpen}
            aria-label="Attendance report actions"
          >
            <FiMoreVertical />
          </button>

          {actionMenuOpen ? (
            <div className="hrAttMenu__panel" role="menu" aria-label="Attendance report actions">
              {canImport ? (
                <button
                  type="button"
                  className="hrAttMenu__item"
                  role="menuitem"
                  onClick={onOpenImport}
                  disabled={importDisabled}
                >
                  <FiUpload aria-hidden="true" />
                  <span>{importLoading ? 'Importing CSV...' : 'Import Attendance (CSV)'}</span>
                </button>
              ) : null}

              <button
                type="button"
                className="hrAttMenu__item"
                role="menuitem"
                onClick={onOpenExport}
                disabled={exportDisabled}
              >
                <FiDownload aria-hidden="true" />
                <span>{exportLoading ? 'Preparing CSV...' : 'Export Attendance (CSV)'}</span>
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
