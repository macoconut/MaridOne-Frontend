import { type EmployeeSortKey } from '../../lib/employeeSort';
import SortMenu, { type SortOption } from './SortMenu';

type EmployeeSortMenuProps = {
  value: EmployeeSortKey;
  onChange: (value: EmployeeSortKey) => void;
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

const SORT_OPTIONS: Array<SortOption<EmployeeSortKey>> = [
  {
    value: 'id',
    label: 'EMP ID',
    hint: 'Show the lowest employee number first.',
  },
  {
    value: 'name',
    label: 'NAME',
    hint: 'Show employees in alphabetical order.',
  },
];

export default function EmployeeSortMenu({ value, onChange, className, open, onOpenChange }: EmployeeSortMenuProps) {
  return (
    <SortMenu
      value={value}
      onChange={onChange}
      options={SORT_OPTIONS}
      className={className}
      panelLabel="Sort employees"
      open={open}
      onOpenChange={onOpenChange}
    />
  );
}
