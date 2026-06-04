import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import EmployeeTable from './EmployeeTable';

const rows = [
  {
    id: '1',
    name: 'Alice Cruz',
    username: 'alice',
    status: 'REGULAR',
    employmentType: 'REGULAR_FULL_TIME',
    email: 'alice@example.com',
    personalEmail: 'alice.personal@example.com',
    phone: '09171234567',
    designation: 'EMPLOYEE',
    position: 'EMPLOYEE',
    department: 'People Operations Department',
    exemptionStatus: 'NON_EXEMPT',
    searchIndex: 'alice cruz employee',
  },
];

describe('EmployeeTable', () => {
  it('renders rows from props', () => {
    render(
      <EmployeeTable
        emptyStateMessage="Waiting for backend data."
        onOpenDelete={vi.fn()}
        onOpenDetails={vi.fn()}
        onOpenEdit={vi.fn()}
        rows={rows}
      />
    );

    expect(screen.getByText('Alice Cruz')).toBeInTheDocument();
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
  });

  it('shows an empty state when there are no rows', () => {
    render(
      <EmployeeTable
        emptyStateMessage="Waiting for backend data."
        onOpenDelete={vi.fn()}
        onOpenDetails={vi.fn()}
        onOpenEdit={vi.fn()}
        rows={[]}
      />
    );

    expect(screen.getByText('No employee records to show. Waiting for backend data.')).toBeInTheDocument();
  });

  it('triggers row and action callbacks', () => {
    const onOpenDetails = vi.fn();
    const onOpenEdit = vi.fn();

    render(
      <EmployeeTable
        emptyStateMessage="Waiting for backend data."
        onOpenDelete={vi.fn()}
        onOpenDetails={onOpenDetails}
        onOpenEdit={onOpenEdit}
        rows={rows}
      />
    );

    fireEvent.click(screen.getByText('Alice Cruz'));
    fireEvent.click(screen.getByTitle('Edit employee'));

    expect(onOpenDetails).toHaveBeenCalledWith('1');
    expect(onOpenEdit).toHaveBeenCalledWith(rows[0]);
  });
});
