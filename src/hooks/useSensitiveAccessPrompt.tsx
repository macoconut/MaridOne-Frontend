import { useCallback, useRef, useState } from 'react';
import { isSensitiveAccessRequired } from '../lib/sensitiveAccess';

export function useSensitiveAccessPrompt() {
  const pendingActionRef = useRef<null | (() => Promise<void>)>(null);
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState('Verify sensitive access to continue.');

  const requestVerification = useCallback((action: () => Promise<void>, nextNotice?: string) => {
    pendingActionRef.current = action;
    setNotice(nextNotice || 'Verify sensitive access to continue.');
    setOpen(true);
  }, []);

  const handleProtectedError = useCallback((error: unknown, action: () => Promise<void>, nextNotice?: string) => {
    if (!isSensitiveAccessRequired(error)) return false;
    requestVerification(action, nextNotice);
    return true;
  }, [requestVerification]);

  const handleVerified = useCallback(() => {
    setOpen(false);
    const pendingAction = pendingActionRef.current;
    pendingActionRef.current = null;
    if (pendingAction) {
      void pendingAction();
    }
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    pendingActionRef.current = null;
  }, []);

  return {
    open,
    notice,
    close,
    handleVerified,
    handleProtectedError,
    requestVerification,
  };
}
