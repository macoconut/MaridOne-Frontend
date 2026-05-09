import { useMemo, useRef, useState, type ReactNode } from 'react';
import {
  PageRefreshContext,
  type PageRefreshContextValue,
  type PageRefreshHandler,
} from './pageRefreshContext';

export function PageRefreshProvider({ children }: { children: ReactNode }) {
  const handlerRef = useRef<PageRefreshHandler | null>(null);
  const isRefreshingRef = useRef(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const value = useMemo<PageRefreshContextValue>(
    () => ({
      isRefreshing,
      async refreshPage() {
        if (isRefreshingRef.current) return;

        const handler = handlerRef.current;
        if (!handler) {
          window.location.reload();
          return;
        }

        isRefreshingRef.current = true;
        setIsRefreshing(true);

        try {
          await handler();
        } finally {
          isRefreshingRef.current = false;
          setIsRefreshing(false);
        }
      },
      setHandler(handler) {
        handlerRef.current = handler;
      },
    }),
    [isRefreshing]
  );

  return <PageRefreshContext.Provider value={value}>{children}</PageRefreshContext.Provider>;
}
