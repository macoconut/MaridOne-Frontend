import { useCallback, useEffect, useRef } from 'react';
import { useRegisterPageRefresh } from '../lib/utils/usePageRefresh';

type UseAutoRefreshingPageOptions = {
  enabled?: boolean;
  intervalMs?: number;
  refreshOnFocus?: boolean;
  focusRefreshCooldownMs?: number;
};

function isEditableElement(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;

  if (target.isContentEditable) return true;

  const editableAncestor = target.closest(
    'input, textarea, select, [contenteditable="true"], [role="textbox"]'
  );

  return editableAncestor instanceof HTMLElement;
}

function shouldPauseAutoRefresh() {
  if (typeof document === 'undefined') return false;

  if (document.body.classList.contains('modal-open')) {
    return true;
  }

  return isEditableElement(document.activeElement);
}

export function useAutoRefreshingPage(
  handler: () => void | Promise<void>,
  options: UseAutoRefreshingPageOptions = {}
) {
  const {
    enabled = true,
    intervalMs = 10000,
    refreshOnFocus = true,
    focusRefreshCooldownMs = 3000,
  } = options;
  const handlerRef = useRef(handler);
  const isRefreshingRef = useRef(false);
  const lastRefreshAtRef = useRef(0);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  const refreshPage = useCallback(async () => {
    if (isRefreshingRef.current) return;

    isRefreshingRef.current = true;
    try {
      lastRefreshAtRef.current = Date.now();
      await handlerRef.current();
    } finally {
      isRefreshingRef.current = false;
    }
  }, []);

  useRegisterPageRefresh(refreshPage);

  useEffect(() => {
    if (!enabled || intervalMs <= 0 || typeof window === 'undefined') return;

    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      if (shouldPauseAutoRefresh()) return;
      void refreshPage();
    }, intervalMs);

    return () => window.clearInterval(intervalId);
  }, [enabled, intervalMs, refreshPage]);

  useEffect(() => {
    if (!enabled || !refreshOnFocus || typeof window === 'undefined') return;

    const shouldRefreshOnForeground = () => {
      if (document.visibilityState !== 'visible') return false;
      if (shouldPauseAutoRefresh()) return false;
      return Date.now() - lastRefreshAtRef.current >= focusRefreshCooldownMs;
    };

    const handleFocus = () => {
      if (!shouldRefreshOnForeground()) return;
      void refreshPage();
    };

    const handleVisibilityChange = () => {
      if (!shouldRefreshOnForeground()) return;
      void refreshPage();
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, refreshOnFocus, focusRefreshCooldownMs, refreshPage]);

  return refreshPage;
}
