import { useContext, useEffect } from 'react';
import { PageRefreshContext, type PageRefreshHandler } from './pageRefreshContext';

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
