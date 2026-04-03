import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

type PageRefreshHandler = () => void | Promise<void>;

type PageRefreshContextValue = {
  isRefreshing: boolean;
  refreshPage: () => Promise<void>;
  setHandler: (handler: PageRefreshHandler | null) => void;
};

const PageRefreshContext = createContext<PageRefreshContextValue | null>(null);

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

export function usePageRefresh() {
  const context = useContext(PageRefreshContext);

  if (!context) {
    throw new Error('usePageRefresh must be used within a PageRefreshProvider.');
  }

  return context;
}

export function useRegisterPageRefresh(handler: PageRefreshHandler | null) {
  const { setHandler } = usePageRefresh();

  useEffect(() => {
    setHandler(handler);

    return () => setHandler(null);
  }, [handler, setHandler]);
}
