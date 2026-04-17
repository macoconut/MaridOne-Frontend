import { createContext } from 'react';

export type LoadingContextType = {
  isLoading: boolean;
  showLoading: () => void;
  hideLoading: () => void;
};

export const LoadingContext = createContext<LoadingContextType>({
  isLoading: false,
  showLoading: () => undefined,
  hideLoading: () => undefined,
});
