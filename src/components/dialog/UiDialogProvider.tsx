import {
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import AlertDialog from './AlertDialog';
import {
  defaultTitleFor,
  type DialogOptions,
  type DialogState,
  type UiDialogContextValue,
  UiDialogContext,
} from './uiDialogContext';

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
