import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { GLOBAL_LOADING_EVENT } from './loadingEvents';
import { LoadingContext } from './loadingContextValue';

const REQUEST_LOADING_DELAY_MS = 180;

export const LoadingProvider = ({ children }: { children: ReactNode }) => {
  const requestDelayTimerRef = useRef<number | null>(null);
  const [manualLoadingCount, setManualLoadingCount] = useState(0);
  const [requestLoadingCount, setRequestLoadingCount] = useState(0);
  const [requestLoadingVisible, setRequestLoadingVisible] = useState(false);
  const showLoading = useCallback(() => setManualLoadingCount((count) => count + 1), []);
  const hideLoading = useCallback(() => {
    setManualLoadingCount((count) => Math.max(0, count - 1));
  }, []);
  const isLoading = manualLoadingCount > 0 || requestLoadingVisible;

  useEffect(() => {
    function handleGlobalLoading(event: Event) {
      const detail = event instanceof CustomEvent ? (event.detail as { active?: boolean }) : null;
      const delta = detail?.active ? 1 : -1;
      setRequestLoadingCount((count) => Math.max(0, count + delta));
    }

    window.addEventListener(GLOBAL_LOADING_EVENT, handleGlobalLoading);
    return () => window.removeEventListener(GLOBAL_LOADING_EVENT, handleGlobalLoading);
  }, []);

  useEffect(() => {
    if (requestLoadingCount <= 0) {
      if (requestDelayTimerRef.current !== null) {
        window.clearTimeout(requestDelayTimerRef.current);
        requestDelayTimerRef.current = null;
      }
      setRequestLoadingVisible(false);
      return;
    }

    if (!requestLoadingVisible && requestDelayTimerRef.current === null) {
      requestDelayTimerRef.current = window.setTimeout(() => {
        requestDelayTimerRef.current = null;
        setRequestLoadingVisible(true);
      }, REQUEST_LOADING_DELAY_MS);
    }
  }, [requestLoadingCount, requestLoadingVisible]);

  useEffect(() => () => {
    if (requestDelayTimerRef.current !== null) {
      window.clearTimeout(requestDelayTimerRef.current);
    }
  }, []);

  const value = useMemo(
    () => ({ isLoading, showLoading, hideLoading }),
    [hideLoading, isLoading, showLoading]
  );

  return (
    <LoadingContext.Provider value={value}>
      {children}
      {isLoading && (
        <div className="global-spinner-overlay" role="status" aria-live="polite" aria-label="Loading">
          <div className="spinner" aria-hidden="true"></div>
        </div>
      )}
    </LoadingContext.Provider>
  );
};
