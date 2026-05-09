import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isSensitiveAccessRequired } from '../lib/utils/sensitiveAccess';
import { getSensitiveAccessToken, SENSITIVE_ACCESS_CHANGE_EVENT } from '../lib/utils/session';

type SensitiveAccessPromptOptions = {
  entryNotice?: string;
};

function hasActiveSensitiveAccess() {
  return Boolean(getSensitiveAccessToken());
}

export function useSensitiveAccessPrompt(options: SensitiveAccessPromptOptions = {}) {
  const { entryNotice } = options;
  const pendingActionRef = useRef<null | (() => Promise<void>)>(null);
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState('Enter your password to continue.');
  const [isVerified, setIsVerified] = useState(() => hasActiveSensitiveAccess());

  const syncVerificationState = useCallback(() => {
    setIsVerified(hasActiveSensitiveAccess());
  }, []);

  useEffect(() => {
    const handleSensitiveAccessChange = () => syncVerificationState();
    const handleWindowFocus = () => syncVerificationState();

    window.addEventListener(SENSITIVE_ACCESS_CHANGE_EVENT, handleSensitiveAccessChange);
    window.addEventListener('storage', handleSensitiveAccessChange);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      window.removeEventListener(SENSITIVE_ACCESS_CHANGE_EVENT, handleSensitiveAccessChange);
      window.removeEventListener('storage', handleSensitiveAccessChange);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [syncVerificationState]);

  useEffect(() => {
    if (!entryNotice || isVerified) return;

    pendingActionRef.current = null;
    const timeoutId = setTimeout(() => {
      setNotice(entryNotice);
      setOpen(true);
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [entryNotice, isVerified]);

  const requestVerification = useCallback((action: () => Promise<void>, nextNotice?: string) => {
    pendingActionRef.current = action;
    setNotice(nextNotice || 'Enter your password to continue.');
    setOpen(true);
  }, []);

  const handleProtectedError = useCallback((error: unknown, action: () => Promise<void>, nextNotice?: string) => {
    if (!isSensitiveAccessRequired(error)) return false;
    setIsVerified(false);
    requestVerification(action, nextNotice);
    return true;
  }, [requestVerification]);

  const handleVerified = useCallback(() => {
    setOpen(false);
    syncVerificationState();
    const pendingAction = pendingActionRef.current;
    pendingActionRef.current = null;
    if (pendingAction) {
      void pendingAction();
    }
  }, [syncVerificationState]);

  const close = useCallback(() => {
    setOpen(false);
    pendingActionRef.current = null;
  }, []);

  return useMemo(() => ({
    open,
    isVerified,
    notice,
    close,
    handleVerified,
    handleProtectedError,
    requestVerification,
  }), [open, isVerified, notice, close, handleVerified, handleProtectedError, requestVerification]);
}
