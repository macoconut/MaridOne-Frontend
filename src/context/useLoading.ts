import { useContext } from 'react';
import { LoadingContext } from './loadingContextValue';

export function useLoading() {
  return useContext(LoadingContext);
}
