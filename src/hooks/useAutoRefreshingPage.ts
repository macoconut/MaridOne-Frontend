import { useCallback, useEffect, useRef } from 'react';
import { useRegisterPageRefresh } from '../lib/pageRefresh';

type UseAutoRefreshingPageOptions = {
  enabled?: boolean;
  intervalMs?: number;
  refreshOnFocus?: boolean;
};

export function useAutoRefreshingPage(
  handler: () => void | Promise<void>,
  options: UseAutoRefreshingPageOptions = {}
) {
  const { enabled = true, intervalMs = 10000, refreshOnFocus = true } = options;
  const handlerRef = useRef(handler);
  const isRefreshingRef = useRef(false);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  const refreshPage = useCallback(async () => {
    if (isRefreshingRef.current) return;

    isRefreshingRef.current = true;
    try {
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
      void refreshPage();
    }, intervalMs);

    return () => window.clearInterval(intervalId);
  }, [enabled, intervalMs, refreshPage]);

  useEffect(() => {
    if (!enabled || !refreshOnFocus || typeof window === 'undefined') return;

    const handleFocus = () => {
      if (document.visibilityState !== 'visible') return;
      void refreshPage();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      void refreshPage();
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, refreshOnFocus, refreshPage]);

  return refreshPage;
}
