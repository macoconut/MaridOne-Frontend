import { useEffect, useId, useRef, useState } from 'react';
import { FiShuffle } from 'react-icons/fi';
import { getEmployeeSortLabel, type EmployeeSortKey } from '../../lib/employeeSort';

type EmployeeSortMenuProps = {
  value: EmployeeSortKey;
  onChange: (value: EmployeeSortKey) => void;
  className?: string;
};

const SORT_OPTIONS: Array<{
  value: EmployeeSortKey;
  label: string;
  hint: string;
}> = [
  {
    value: 'id',
    label: 'Employee ID',
    hint: 'Show the lowest employee number first.',
  },
  {
    value: 'name',
    label: 'Employee Name',
    hint: 'Show employees in alphabetical order.',
  },
];

export default function EmployeeSortMenu({ value, onChange, className }: EmployeeSortMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const panelId = useId();
  const rootClassName = ['uiEmployeeSort', className].filter(Boolean).join(' ');

  useEffect(() => {
    if (!open) return undefined;

    function handlePointerDown(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div className={rootClassName} ref={menuRef}>
      <button
        type="button"
        className={`uiEmployeeSort__toggle ${open ? 'is-open' : ''}`}
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="menu"
        onClick={() => setOpen((current) => !current)}
      >
        <FiShuffle aria-hidden="true" />
        <span>Sort</span>
        <span className="uiEmployeeSort__value">{getEmployeeSortLabel(value)}</span>
      </button>

      {open ? (
        <div id={panelId} className="uiEmployeeSort__panel" role="menu" aria-label="Sort employees">
          {SORT_OPTIONS.map((option) => {
            const isSelected = option.value === value;

            return (
              <button
                key={option.value}
                type="button"
                role="menuitemradio"
                aria-checked={isSelected}
                className={`uiEmployeeSort__option ${isSelected ? 'is-selected' : ''}`}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                <span className="uiEmployeeSort__optionLabel">{option.label}</span>
                <span className="uiEmployeeSort__optionHint">{option.hint}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
