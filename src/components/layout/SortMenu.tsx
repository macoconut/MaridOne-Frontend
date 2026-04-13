import { useEffect, useId, useRef, useState } from 'react';
import { FiShuffle } from 'react-icons/fi';

export type SortOption<T> = {
  value: T;
  label: string;
  hint: string;
};

type SortMenuProps<T> = {
  value: T;
  onChange: (value: T) => void;
  options: Array<SortOption<T>>;
  label?: string;
  className?: string;
  panelLabel?: string;
};

export default function SortMenu<T>({
  value,
  onChange,
  options,
  label = 'Sort',
  className,
  panelLabel = 'Sort options',
}: SortMenuProps<T>) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const panelId = useId();
  const rootClassName = ['uiEmployeeSort', className].filter(Boolean).join(' ');

  const selectedOption = options.find((opt) => opt.value === value);

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
        <span>{label}</span>
        <span className="uiEmployeeSort__value">{selectedOption?.label || String(value)}</span>
      </button>

      {open ? (
        <div id={panelId} className="uiEmployeeSort__panel" role="menu" aria-label={panelLabel}>
          {options.map((option) => {
            const isSelected = option.value === value;

            return (
              <button
                key={String(option.value)}
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
