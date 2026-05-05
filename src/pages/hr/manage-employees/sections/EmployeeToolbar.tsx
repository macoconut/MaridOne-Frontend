import type { RefObject } from 'react';
import { FiDownload, FiFilter, FiMoreVertical, FiSearch, FiXCircle } from 'react-icons/fi';
import EmployeeSortMenu from '../../../../components/layout/EmployeeSortMenu';
import type { EmployeeSortKey } from '../../../../lib/utils/employeeSort';

type EmployeeToolbarProps = {
  activeFilterCount: number;
  departmentFilter: string;
  exportMenuOpen: boolean;
  exportMenuRef: RefObject<HTMLDivElement | null>;
  filterDepartmentOptions: string[];
  filterOpen: boolean;
  filterPositionOptions: string[];
  onClearFilters: () => void;
  onClearSearch: () => void;
  onDepartmentFilterChange: (value: string) => void;
  onExportEmployeeData: () => void;
  onPositionFilterChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onSortChange: (value: EmployeeSortKey) => void;
  onSortMenuOpenChange: (open: boolean) => void;
  onStatusFilterChange: (value: string) => void;
  onToggleExportMenu: () => void;
  onToggleFilterPanel: () => void;
  positionFilter: string;
  searchValue: string;
  sortMenuOpen: boolean;
  statusFilter: string;
  statusOptions: string[];
  employeeSort: EmployeeSortKey;
};

export default function EmployeeToolbar({
  activeFilterCount,
  departmentFilter,
  employeeSort,
  exportMenuOpen,
  exportMenuRef,
  filterDepartmentOptions,
  filterOpen,
  filterPositionOptions,
  onClearFilters,
  onClearSearch,
  onDepartmentFilterChange,
  onExportEmployeeData,
  onPositionFilterChange,
  onSearchChange,
  onSortChange,
  onSortMenuOpenChange,
  onStatusFilterChange,
  onToggleExportMenu,
  onToggleFilterPanel,
  positionFilter,
  searchValue,
  sortMenuOpen,
  statusFilter,
  statusOptions,
}: EmployeeToolbarProps) {
  return (
    <div className="hrEmpToolbar">
      <label className="uSearch" aria-label="Search employees">
        <FiSearch />
        <input
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search by employee name, ID, username, company or personal email, phone, role, or department"
        />
        {searchValue ? (
          <button type="button" aria-label="Clear employee search" onClick={onClearSearch}>
            <FiXCircle />
          </button>
        ) : null}
      </label>

      <div className="hrEmpToolbar__actions">
        <EmployeeSortMenu
          value={employeeSort}
          onChange={onSortChange}
          open={sortMenuOpen}
          onOpenChange={onSortMenuOpenChange}
        />

        <div className="uFilter">
          <button
            type="button"
            className={`uFilter__toggle ${filterOpen ? 'is-open' : ''} ${activeFilterCount > 0 ? 'is-active' : ''}`}
            onClick={onToggleFilterPanel}
          >
            <FiFilter />
            <span>Filter</span>
          </button>

          {filterOpen ? (
            <div className="uFilter__panel">
              <label className="uFilter__field">
                <span>Status</span>
                <select value={statusFilter} onChange={(event) => onStatusFilterChange(event.target.value)}>
                  <option value="all">All Statuses</option>
                  {statusOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="uFilter__field">
                <span>Role</span>
                <select value={positionFilter} onChange={(event) => onPositionFilterChange(event.target.value)}>
                  <option value="all">All Roles</option>
                  {filterPositionOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="uFilter__field">
                <span>Department</span>
                <select value={departmentFilter} onChange={(event) => onDepartmentFilterChange(event.target.value)}>
                  <option value="all">All Departments</option>
                  {filterDepartmentOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <div className="uFilter__actions">
                <button type="button" onClick={onClearFilters}>
                  Reset Filters
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="hrEmpMenu" ref={exportMenuRef}>
          <button
            type="button"
            className={`hrEmpMenu__toggle ${exportMenuOpen ? 'is-open' : ''}`}
            onClick={onToggleExportMenu}
            aria-haspopup="menu"
            aria-expanded={exportMenuOpen}
            aria-label="More employee table actions"
          >
            <FiMoreVertical />
          </button>

          {exportMenuOpen ? (
            <div className="hrEmpMenu__panel" role="menu" aria-label="Employee table actions">
              <button type="button" className="hrEmpMenu__item" role="menuitem" onClick={onExportEmployeeData}>
                <FiDownload aria-hidden="true" />
                <span>Export as CSV</span>
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
