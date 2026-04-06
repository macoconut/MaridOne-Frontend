import { useCallback, useEffect, useState } from 'react';

type UseUnsavedChangesPromptOptions = {
  isOpen: boolean;
  isDirty: boolean;
  isBusy?: boolean;
  onDiscard: () => void;
};

export function useUnsavedChangesPrompt({
  isOpen,
  isDirty,
  isBusy = false,
  onDiscard,
}: UseUnsavedChangesPromptOptions) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!isOpen || !isDirty) {
      setConfirmOpen(false);
    }
  }, [isDirty, isOpen]);

  useEffect(() => {
    if (!isOpen || !isDirty) return undefined;

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = '';
    }

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty, isOpen]);

  const requestClose = useCallback(() => {
    if (isBusy) return;
    if (isOpen && isDirty) {
      setConfirmOpen(true);
      return;
    }
    onDiscard();
  }, [isBusy, isOpen, isDirty, onDiscard]);

  const discardAndClose = useCallback(() => {
    setConfirmOpen(false);
    onDiscard();
  }, [onDiscard]);

  const keepEditing = useCallback(() => {
    setConfirmOpen(false);
  }, []);

  return {
    confirmOpen,
    requestClose,
    discardAndClose,
    keepEditing,
  };
}
