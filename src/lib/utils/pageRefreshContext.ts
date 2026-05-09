import { createContext } from 'react';

export type PageRefreshHandler = () => void | Promise<void>;

export type PageRefreshContextValue = {
  isRefreshing: boolean;
  refreshPage: () => Promise<void>;
  setHandler: (handler: PageRefreshHandler | null) => void;
};

export const PageRefreshContext = createContext<PageRefreshContextValue | null>(null);
