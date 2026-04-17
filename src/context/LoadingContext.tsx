import { useState, type ReactNode } from 'react';
import { LoadingContext } from './loadingContextValue';

export const LoadingProvider = ({ children }: { children: ReactNode }) => {
  const [isLoading, setIsLoading] = useState(false);
  const showLoading = () => setIsLoading(true);
  const hideLoading = () => setIsLoading(false);

  return (
    <LoadingContext.Provider value={{ isLoading, showLoading, hideLoading }}>
      {children}
      {isLoading && (
        <div className="global-spinner-overlay">
          <div className="spinner"></div>
        </div>
      )}
    </LoadingContext.Provider>
  );
};
