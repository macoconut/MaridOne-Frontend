import { createContext } from 'react';
import type { AlertDialogVariant } from './AlertDialog';

export type DialogOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  variant?: AlertDialogVariant;
};

export type DialogState = Required<DialogOptions>;

export type UiDialogContextValue = {
  dismissDialog: () => void;
  showDialog: (options: DialogOptions) => void;
  showError: (message: string, title?: string) => void;
  showInfo: (message: string, title?: string) => void;
  showSuccess: (message: string, title?: string) => void;
};

export const UiDialogContext = createContext<UiDialogContextValue | null>(null);

export function defaultTitleFor(variant: AlertDialogVariant) {
  if (variant === 'error') return 'Something went wrong';
  if (variant === 'success') return 'Success';
  return 'Notice';
}
