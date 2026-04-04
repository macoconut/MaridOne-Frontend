import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import AlertDialog, { type AlertDialogVariant } from './AlertDialog';

type DialogOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  variant?: AlertDialogVariant;
};

type DialogState = Required<DialogOptions>;

type UiDialogContextValue = {
  dismissDialog: () => void;
  showDialog: (options: DialogOptions) => void;
  showError: (message: string, title?: string) => void;
  showInfo: (message: string, title?: string) => void;
  showSuccess: (message: string, title?: string) => void;
};

const UiDialogContext = createContext<UiDialogContextValue | null>(null);

function defaultTitleFor(variant: AlertDialogVariant) {
  if (variant === 'error') return 'Something went wrong';
  if (variant === 'success') return 'Success';
  return 'Notice';
}

export function UiDialogProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<DialogState | null>(null);

  const dismissDialog = useCallback(() => {
    setDialog(null);
  }, []);

  const showDialog = useCallback((options: DialogOptions) => {
    const message = options.message.trim();
    if (!message) return;

    const variant = options.variant ?? 'info';
    setDialog({
      title: options.title?.trim() || defaultTitleFor(variant),
      message,
      confirmLabel: options.confirmLabel?.trim() || 'Close',
      variant,
    });
  }, []);

  const showError = useCallback(
    (message: string, title = 'Something went wrong') => {
      showDialog({
        title,
        message,
        variant: 'error',
      });
    },
    [showDialog]
  );

  const showInfo = useCallback(
    (message: string, title = 'Notice') => {
      showDialog({
        title,
        message,
        variant: 'info',
      });
    },
    [showDialog]
  );

  const showSuccess = useCallback(
    (message: string, title = 'Success') => {
      showDialog({
        title,
        message,
        variant: 'success',
      });
    },
    [showDialog]
  );

  const value = useMemo<UiDialogContextValue>(
    () => ({
      dismissDialog,
      showDialog,
      showError,
      showInfo,
      showSuccess,
    }),
    [dismissDialog, showDialog, showError, showInfo, showSuccess]
  );

  return (
    <UiDialogContext.Provider value={value}>
      {children}
      <AlertDialog
        open={Boolean(dialog)}
        title={dialog?.title ?? ''}
        message={dialog?.message ?? ''}
        confirmLabel={dialog?.confirmLabel}
        variant={dialog?.variant}
        onClose={dismissDialog}
      />
    </UiDialogContext.Provider>
  );
}

export function useUiDialog() {
  const value = useContext(UiDialogContext);

  if (!value) {
    throw new Error('useUiDialog must be used within UiDialogProvider.');
  }

  return value;
}
