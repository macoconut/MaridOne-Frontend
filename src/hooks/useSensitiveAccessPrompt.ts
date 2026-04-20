import { useCallback, useMemo, useRef, useState } from 'react';
import { isSensitiveAccessRequired } from '../lib/sensitiveAccess';

export function useSensitiveAccessPrompt() {
  const pendingActionRef = useRef<null | (() => Promise<void>)>(null);
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState('Enter your password to continue.');

  const requestVerification = useCallback((action: () => Promise<void>, nextNotice?: string) => {
    pendingActionRef.current = action;
    setNotice(nextNotice || 'Enter your password to continue.');
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

  return useMemo(() => ({
    open,
    notice,
    close,
    handleVerified,
    handleProtectedError,
    requestVerification,
  }), [open, notice, close, handleVerified, handleProtectedError, requestVerification]);
}
