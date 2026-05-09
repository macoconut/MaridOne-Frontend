export const Status = {
    PENDING: 'PENDING',
    PENDING_MANAGER: 'PENDING_MANAGER',
    PENDING_HR: 'PENDING_HR',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
    CANCELLED: 'CANCELLED',
} as const;

export type Status = typeof Status[keyof typeof Status];